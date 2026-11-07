import { randomUUID } from 'node:crypto';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { parseSourcingCriteria, sourcingItems } from '@/lib/services/sourcingCriteria';
import { scopedTiktokQueries, SourcingInputError } from '@/lib/services/sourcingSearch';
import { sourcingBudgetUsd, sourcingRequest } from '@/lib/services/sourcingApify';
import { createSourcingRun, publicSourcingRun, SourcingRunError } from '@/lib/services/sourcingRuns';
import type { SourcingRequest, SourcingRun } from '@/lib/types/sourcing';

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export async function sourcingWorkspace(owner: string) {
  const db = getMessengerPool();
  const rows = (await db.query('SELECT * FROM sourcing_requests WHERE owner=$1 ORDER BY updated_at DESC LIMIT 30', [owner])).rows;
  const runs = rows.length ? (await db.query('SELECT * FROM sourcing_runs WHERE owner=$1 AND id=ANY($2::uuid[])', [owner, rows.flatMap(row => row.run_id ? [row.run_id] : [])])).rows : [];
  const decisions = (await db.query('SELECT * FROM sourcing_decisions WHERE owner=$1 ORDER BY updated_at DESC LIMIT 500', [owner])).rows;
  return { requests: rows.map(row => ({ id: row.id, revision: row.revision, criteria: row.criteria_json, plan: row.plan_json,
    approvedAt: row.approved_at == null ? null : Number(row.approved_at), runId: row.run_id, updatedAt: Number(row.updated_at),
    run: row.run_id ? publicSourcingRun(runs.find(run => run.id === row.run_id)) : null })) as SourcingRequest[],
    decisions: decisions.map(row => ({ runId: row.run_id, itemKey: row.item_key, status: row.status, note: row.note, updatedAt: Number(row.updated_at) })) };
}
export async function prepareSourcingRequest(owner: string, value: unknown, id?: unknown, revision?: unknown) {
  const criteria = parseSourcingCriteria(value);
  if (criteria.kind === 'tiktok') criteria.keywords = scopedTiktokQueries(criteria.industry, criteria.keywords, criteria.product);
  const prepared = sourcingRequest(criteria.kind, { ...criteria });
  const queries = criteria.kind === 'tiktok' ? criteria.keywords : prepared.context.queries;
  const plan = { queries, market: 'VN', language: 'vi', days: 7, resultLimit: criteria.resultLimit, maxChargeUsd: sourcingBudgetUsd[criteria.kind], timeoutSeconds: 300 };
  const db = getMessengerPool(), now = Date.now();
  if (id !== undefined) {
    if (!validId(id) || !Number.isSafeInteger(revision)) throw new SourcingInputError('Phiên bản yêu cầu không hợp lệ.');
    const saved = await db.query(`UPDATE sourcing_requests SET criteria_json=$3::jsonb,plan_json=$4::jsonb,revision=revision+1,approved_at=NULL,updated_at=$5
      WHERE id=$1 AND owner=$2 AND revision=$6 AND run_id IS NULL RETURNING id`, [id, owner, JSON.stringify(criteria), JSON.stringify(plan), now, revision]);
    if (!saved.rowCount) throw new SourcingRunError('Yêu cầu đã chạy hoặc đã thay đổi. Tạo yêu cầu mới để thay tiêu chí.', 409);
    return id;
  }
  const nextId = randomUUID();
  await db.query('INSERT INTO sourcing_requests(id,owner,criteria_json,plan_json,created_at,updated_at) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$5)', [nextId, owner, JSON.stringify(criteria), JSON.stringify(plan), now]);
  return nextId;
}
export async function runSourcingRequest(owner: string, id: unknown, revision: unknown, confirmed: unknown) {
  if (!validId(id) || !Number.isSafeInteger(revision) || confirmed !== true) throw new SourcingInputError('Xác nhận truy vấn và chi phí trước khi chạy.');
  const row = (await getMessengerPool().query('SELECT * FROM sourcing_requests WHERE id=$1 AND owner=$2', [id, owner])).rows[0];
  if (!row) throw new SourcingRunError('Yêu cầu tìm nguồn không tồn tại.', 404);
  if (row.run_id) {
    const run = (await getMessengerPool().query('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [row.run_id, owner])).rows[0];
    return publicSourcingRun(run);
  }
  const criteria = parseSourcingCriteria(row.criteria_json);
  return createSourcingRun(owner, criteria.kind, { ...criteria }, { id, revision: Number(revision) });
}
export async function readSourcingSelection(owner: string, runId: unknown, key: unknown) {
  if (!validId(runId) || typeof key !== 'string' || key.length > 2500) throw new SourcingInputError('Kết quả không hợp lệ.');
  const row = (await getMessengerPool().query('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [runId, owner])).rows[0];
  if (!row) throw new SourcingRunError('Lượt tìm không tồn tại.', 404);
  const item = sourcingItems(publicSourcingRun(row) as SourcingRun).find(item => item.key === key);
  if (!item) throw new SourcingRunError('Kết quả không thuộc lượt tìm đã hoàn tất.', 404);
  return item;
}
export async function saveSourcingDecision(owner: string, input: Record<string, unknown>) {
  await readSourcingSelection(owner, input.runId, input.itemKey);
  if (!['shortlist', 'checked', 'rejected'].includes(String(input.status)) || typeof input.note !== 'string' || input.note.length > 1000) throw new SourcingInputError('Đánh giá kết quả không hợp lệ.');
  await getMessengerPool().query(`INSERT INTO sourcing_decisions(owner,run_id,item_key,status,note,updated_at) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(owner,run_id,item_key) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at`,
  [owner, input.runId, input.itemKey, input.status, input.note.trim(), Date.now()]);
}
