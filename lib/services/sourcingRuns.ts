import { randomUUID } from 'node:crypto';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { apifyRequest, apifyToken, normalizeSupplierResults, normalizeTikTok, parseApifyRun, record,
  sourcingRequest, startApifyRun, SourcingProviderError, type SourcingKind } from '@/lib/services/sourcingApify';

export class SourcingRunError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type Run = {
  id: string; owner: string; kind: SourcingKind; status: string; context_json: Record<string, unknown>;
  provider_run_id: string | null; result_json: unknown; error: string | null; created_at: string; updated_at: string;
};
function publicRun(row: Run) {
  return { id: row.id, kind: row.kind, status: row.status, context: row.context_json,
    result: row.result_json, error: row.error, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) };
}

export async function createSourcingRun(owner: string, kind: SourcingKind, input: Record<string, unknown>) {
  const prepared = sourcingRequest(kind, input);
  const token = apifyToken();
  const db = getMessengerPool();
  const client = await db.connect();
  const id = randomUUID(), now = Date.now();
  try {
    await client.query('BEGIN');
    const slot = await client.query(`INSERT INTO sourcing_start_limits(owner,kind,next_start_at) VALUES($1,$2,$3)
      ON CONFLICT(owner,kind) DO UPDATE SET next_start_at=$3
      WHERE sourcing_start_limits.next_start_at<=$4 RETURNING owner`, [owner, kind, now + 60_000, now]);
    if (!slot.rowCount) throw new SourcingRunError('Vui lòng đợi một phút giữa hai lượt tìm cùng loại.', 429);
    const active = await client.query(`SELECT id FROM sourcing_runs WHERE owner=$1 AND kind=$2
      AND status IN ('starting','running','unknown') AND created_at>$3 LIMIT 1`, [owner, kind, now - 360_000]);
    if (active.rowCount) throw new SourcingRunError('Lượt tìm trước đang chạy hoặc chưa rõ trạng thái. Kiểm tra lượt đó trước khi tìm lại.', 429);
    await client.query(`INSERT INTO sourcing_runs(id,owner,kind,status,context_json,created_at,updated_at)
      VALUES($1,$2,$3,'starting',$4::jsonb,$5,$5)`, [id, owner, kind, JSON.stringify(prepared.context), now]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }

  let provider;
  try { provider = await startApifyRun(kind, prepared.actorInput, token); }
  catch (error) {
    const rejected = error instanceof SourcingProviderError && error.code === 'APIFY_REJECTED';
    await db.query(`UPDATE sourcing_runs SET status=$2,error=$3,updated_at=$4 WHERE id=$1`,
      [id, rejected ? 'failed' : 'unknown', rejected ? 'Apify từ chối khởi chạy. Kiểm tra cấu hình và số dư.'
        : 'Chưa xác định được Apify đã khởi chạy hay chưa. Kiểm tra Console trước khi tạo lượt mới.', Date.now()]);
    // The local ID remains available even when the provider response is lost.
    return publicRun((await db.query<Run>('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [id, owner])).rows[0]);
  }
  const row = (await db.query<Run>(`UPDATE sourcing_runs SET status='running',provider_run_id=$2,updated_at=$3 WHERE id=$1 RETURNING *`,
    [id, provider.id, Date.now()])).rows[0];
  return publicRun(row);
}

export async function readSourcingRun(owner: string, id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new SourcingRunError('Lượt tìm không tồn tại.', 404);
  const db = getMessengerPool();
  const row = (await db.query<Run>('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [id, owner])).rows[0];
  if (!row) throw new SourcingRunError('Lượt tìm không tồn tại.', 404);
  if (row.status !== 'running' || !row.provider_run_id) return publicRun(row);
  const token = apifyToken();
  const run = parseApifyRun(await apifyRequest(`actor-runs/${row.provider_run_id}`, token));
  if (run.id !== row.provider_run_id) throw new SourcingProviderError('Apify trả sai lượt chạy.', 502, 'APIFY_BAD_RESPONSE');
  if (['READY', 'RUNNING', 'TIMING-OUT', 'ABORTING'].includes(run.status)) return publicRun(row);
  let status: string, result: unknown = null, error: string | null = null;
  if (run.status !== 'SUCCEEDED') {
    status = 'failed';
    error = `Thu thập không hoàn tất (${run.status}). Không dùng dữ liệu một phần để phân tích.`;
  } else {
    if (!run.datasetId) throw new SourcingProviderError('Apify chưa trả dataset của lượt chạy.', 502, 'APIFY_BAD_RESPONSE');
    const limit = row.kind === 'tiktok' ? 60 : 2;
    const items = await apifyRequest(`datasets/${run.datasetId}/items?format=json&clean=true&limit=${limit}`, token);
    if (!Array.isArray(items)) throw new SourcingProviderError('Dataset Apify không hợp lệ.', 502, 'APIFY_BAD_DATASET');
    if (row.kind === 'tiktok') {
      const period = record(row.context_json.period) as { from: string; to: string };
      const data = normalizeTikTok(items, period);
      if (items.length && data.rejectedCount === items.length) throw new SourcingProviderError('Không đọc được bản ghi TikTok nào. Kiểm tra output Actor.', 502, 'APIFY_BAD_DATASET');
      result = data;
      status = data.posts.length ? 'succeeded' : 'empty';
    } else {
      const data = normalizeSupplierResults(items);
      result = data;
      status = data.candidates.length ? 'succeeded' : 'empty';
    }
  }
  const updated = (await db.query<Run>(`UPDATE sourcing_runs SET status=$3,result_json=$4::jsonb,error=$5,updated_at=$6
    WHERE id=$1 AND owner=$2 AND status='running' RETURNING *`, [id, owner, status, JSON.stringify(result), error, Date.now()])).rows[0];
  return publicRun(updated || (await db.query<Run>('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [id, owner])).rows[0]);
}
