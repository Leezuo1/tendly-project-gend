import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { CareSource, CareSourceContext } from '@/lib/types/customerCare';
import type { MarketingWorkspace } from '@/lib/types/marketingWorkspace';
import { marketingContextFromWorkspace } from '@/lib/services/marketingCommentContext';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

interface SourceTarget { id: string; cutoff: number; reply_mid: string | null; }
interface SourceSnapshot {
  commentText: string; postText?: string; revision?: number;
  product?: { id: string; sku: string; name: string } | null;
  sku?: string | null; flashPrice?: number | null;
}
interface SourceRow {
  conversation_id: string; message_id: string; reply_sent_at: string; kind: 'post' | 'live';
  comment_id: string; post_id: string | null;
  data: { commentText: string; postText?: string; revision?: number; eventAt?: number; snapshot: SourceSnapshot | null;
    sessionId?: string; title?: string; status?: 'live' | 'ended'; sourceKind?: string | null;
    startedAt?: number; endedAt?: number | null; liveAt?: number | null; sku?: string | null; flashPrice?: number | null };
}

/** Only an exact Page/message ID from a confirmed private reply proves the Messenger recipient. */
export async function readConversationSourceContexts(pageId: string, targets: SourceTarget[],
  db: Pick<Pool, 'query'> = getMessengerPool(), at = Date.now()) {
  const result = new Map<string, CareSourceContext>();
  if (!targets.length) return result;
  const rows = (await db.query(`WITH targets AS (
    SELECT * FROM jsonb_to_recordset($2::jsonb) AS t(id text,cutoff bigint,reply_mid text)
  ), proofs AS (
    SELECT m.conversation_id,m.message_id,m.sent_at AS reply_sent_at,'post' AS kind,f.comment_id,f.post_id,
      jsonb_build_object('commentText',f.text,'postText',f.post_text,'revision',f.revision,
        'eventAt',f.event_at,'snapshot',f.care_context_json) AS data
    FROM messenger_messages m JOIN targets t ON t.id=m.conversation_id AND m.sent_at<=t.cutoff
    JOIN facebook_comments f ON f.page_id=m.page_id AND f.message_id=m.message_id AND f.status='sent'
    JOIN messenger_customers u ON u.id=m.conversation_id
    WHERE m.page_id=$1 AND m.direction='out' AND (f.recipient_id IS NULL OR f.recipient_id=u.psid)
    UNION ALL
    SELECT m.conversation_id,m.message_id,m.sent_at,'live',l.comment_id,s.source_post_id,
      jsonb_build_object('commentText',l.text,'snapshot',l.care_context_json,'sessionId',s.id,
        'title',s.title,'status',s.status,'sourceKind',s.source_kind,'startedAt',s.started_at,
        'endedAt',s.ended_at,'liveAt',s.live_at,'sku',l.sku,'flashPrice',s.flash_json->l.sku)
    FROM messenger_messages m JOIN targets t ON t.id=m.conversation_id AND m.sent_at<=t.cutoff
    JOIN live_comments l ON l.message_id=m.message_id AND l.reply_status='sent'
    JOIN live_sessions s ON s.id=l.session_id AND s.page_id=m.page_id AND s.platform='facebook'
    WHERE m.page_id=$1 AND m.direction='out'
  ), ranked AS (
    SELECT *,ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY reply_sent_at DESC,kind DESC,comment_id) AS rn FROM proofs
  ) SELECT * FROM ranked WHERE rn<=21 OR message_id=ANY($3::text[])
    ORDER BY reply_sent_at DESC,kind DESC,comment_id`, [pageId, JSON.stringify(targets), targets.flatMap(t => t.reply_mid ? [t.reply_mid] : [])])).rows as SourceRow[];
  const workspaceRow = rows.length ? (await db.query('SELECT document FROM marketing_workspaces WHERE page_id=$1', [pageId])).rows[0] : null;
  const workspace: MarketingWorkspace | null = workspaceRow?.document ?? null;
  for (const target of targets) {
    const byMessage = new Map<string, SourceRow>();
    for (const row of rows.filter(row => row.conversation_id === target.id)) {
      // A post handled in Livestream can appear in both tables; it is still one private reply.
      if (!byMessage.has(row.message_id) || row.kind === 'live') byMessage.set(row.message_id, row);
    }
    const sources = [...byMessage.values()].map(row => sourceFromRow(pageId, row, workspace, at));
    const selected = target.reply_mid ? sources.find(source => source.id === target.reply_mid) : sources.length === 1 ? sources[0] : undefined;
    const resolution: CareSourceContext['resolution'] = selected ? target.reply_mid ? 'reply' : 'linked'
      : !sources.length ? 'none' : target.reply_mid ? 'unresolved' : 'ambiguous';
    const visible = selected ? [selected, ...sources.filter(source => source !== selected).slice(0, 4)] : sources.slice(0, 5);
    const context = { resolution, selectedId: selected?.id ?? null, sources: visible,
      blocked: resolution === 'ambiguous' || resolution === 'unresolved' || !!selected?.issues.length };
    result.set(target.id, { ...context, fingerprint: createHash('sha256').update(JSON.stringify(context)).digest('hex') });
  }
  return result;
}

function sourceFromRow(pageId: string, row: SourceRow, workspace: MarketingWorkspace | null, at: number): CareSource {
  const d = row.data, snapshot = d.snapshot;
  const source: CareSource = { id: row.message_id, kind: row.kind, postId: row.post_id, commentId: row.comment_id,
    linkedAt: Number(row.reply_sent_at), commentText: (snapshot?.commentText ?? d.commentText).slice(0, 1000),
    postText: (snapshot?.postText ?? d.postText ?? '').slice(0, 2000), products: [], campaign: null, live: null, issues: [] };
  if (row.kind === 'post' && ((snapshot?.revision !== undefined && snapshot.revision !== d.revision)
    || (!snapshot && Number(d.eventAt) > source.linkedAt))) source.issues.push('Bình luận đã thay đổi sau tin nhắn riêng; cần kiểm tra lại.');
  const marketing = row.post_id && workspace ? marketingContextFromWorkspace(workspace, row.post_id, at) : null;
  if (marketing) {
    const c = marketing.context;
    // A publication belongs to the Page account, never a similarly named mock/cross-channel account.
    if (c.accountId !== pageId) source.issues.push('Chưa xác nhận campaign thuộc đúng Page.');
    else {
      source.products = marketing.knowledge.products.map(({ id, sku, name }) => ({ id, sku, name }));
      source.campaign = { id: c.campaignId, name: c.campaign, version: c.version, message: c.message,
        startsAt: c.startsAt, endsAt: c.endsAt,
        offer: c.originalOffer, offerActive: !!(c.sourceIsCurrent && c.publicationConfirmed && c.campaignActive && c.offer) };
      if (!c.publicationConfirmed || !c.sourceIsCurrent) source.issues.push('Campaign/bài đăng chưa được xác nhận đúng phiên bản hiện hành.');
      if (!c.campaignActive) source.issues.push('Campaign chưa bắt đầu hoặc đã kết thúc.');
      if (c.expiredOffer) source.issues.push('Ưu đãi chưa có hiệu lực hoặc đã hết hạn; không xác nhận deal cũ.');
    }
  }
  if (row.kind === 'live') {
    if (snapshot?.product) source.products = [snapshot.product];
    const flashPrice = snapshot?.flashPrice ?? null;
    const flashActive = flashPrice !== null && d.status === 'live' && d.liveAt != null && d.flashPrice === flashPrice;
    source.live = { id: d.sessionId!, title: d.title!, status: d.status!, sourceKind: d.sourceKind ?? null,
      startedAt: Number(d.startedAt), endedAt: d.endedAt ?? null, sku: snapshot?.sku ?? d.sku ?? null, flashPrice, flashActive };
    if (!snapshot) source.issues.push('Nguồn phiên cũ chưa có bản ghi sản phẩm/deal lúc gửi; cần kiểm tra lại.');
    else if ((snapshot.sku ?? null) !== (d.sku ?? null)) source.issues.push('Sản phẩm của bình luận đã thay đổi; cần kiểm tra lại.');
    if (flashPrice !== (d.flashPrice ?? null) || (flashPrice !== null && !flashActive)) source.issues.push('Deal trong phiên đã thay đổi hoặc hết hiệu lực.');
  }
  return source;
}

export async function readConversationSources(pageId: string, psid: string, messageId: string,
  db: Pick<Pool, 'query'> = getMessengerPool(), at = Date.now()) {
  const row = (await db.query(`SELECT m.conversation_id,m.sent_at,m.reply_to_mid FROM messenger_messages m
    JOIN messenger_conversations c ON c.id=m.conversation_id WHERE m.page_id=$1 AND m.conversation_id=$2
    AND m.message_id=$3 AND m.direction='in' AND c.hidden_at IS NULL`, [pageId, JSON.stringify([pageId, psid]), messageId])).rows[0];
  if (!row) return null;
  const contexts = await readConversationSourceContexts(pageId, [{ id: row.conversation_id, cutoff: Number(row.sent_at), reply_mid: row.reply_to_mid }], db, at);
  return contexts.get(row.conversation_id)!;
}
