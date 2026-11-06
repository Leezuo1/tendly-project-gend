import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { effectiveAiRules } from '@/lib/services/aiConfiguration';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';
import { knowledgeReviewSources, reviewHash } from '@/lib/services/reviewEvidence';
import type { MarketingAccount, MarketingCampaign } from '@/lib/types/marketingWorkspace';
import type { ReviewEvidence, ReviewSource } from '@/lib/types/postReview';

export async function marketingReviewCatalog(pageId: string, campaign: MarketingCampaign, account: MarketingAccount, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<ReviewSource[]> {
  if (!account.mock && account.id !== pageId) throw new MarketingWorkflowError('Nguồn Review không thuộc Page được cấp quyền.', 403);
  const scope = JSON.stringify([pageId, account.id, campaign.id]);
  const platform = account.platform === 'shopee' ? undefined : account.platform;
  const base = { scope, origin: 'campaign', version: `${campaign.id}:${campaign.version}`, confirmedAt: campaign.approvedAt, validFrom: null, validUntil: null };
  const sources: ReviewSource[] = [
    ...knowledgeReviewSources(campaign.knowledge, scope, 'campaign', base.version, campaign.approvedAt),
    { ...base, id: 'campaign:brief', kind: 'brief', data: { goal: campaign.goal, audience: campaign.audience, pain: campaign.pain, message: campaign.message, benefits: campaign.benefits, barriers: campaign.barriers, cta: campaign.cta, link: campaign.link, notes: campaign.notes, format: campaign.format } },
    { ...base, id: 'campaign:voice', kind: 'voice', data: { address: campaign.profile.address, tone: campaign.tone || campaign.profile.tone, avoid: campaign.profile.avoid, rules: effectiveAiRules(campaign.configuration.profiles.review, platform) } },
    { ...base, id: 'campaign:offer', kind: 'offer', data: { ...campaign.offer }, validFrom: campaign.offer.startsAt ? Date.parse(campaign.offer.startsAt) : null, validUntil: campaign.offer.endsAt ? Date.parse(campaign.offer.endsAt) : null },
    { ...base, id: 'campaign:proof', kind: 'proof', data: { proof: campaign.proof, source: campaign.proofSource } },
  ];
  if (!account.mock) {
    const row = (await db.query('SELECT knowledge_json,approved_at,updated_at FROM messenger_ai_settings WHERE page_id=$1 AND approved_at IS NOT NULL', [pageId])).rows[0];
    // Approval can change independently of the campaign, including when a Page had no confirmed knowledge before.
    sources.push({ ...base, id: 'page-knowledge:approval', kind: 'brief', origin: 'page-knowledge', version: String(row?.updated_at ?? 0), confirmedAt: row ? Number(row.approved_at) : null, data: { approved: !!row } });
    if (row) sources.push(...knowledgeReviewSources(parseAiKnowledge(row.knowledge_json), scope, 'page-knowledge', String(row.updated_at), Number(row.approved_at)));
  }
  return sources;
}

export function requireFreshReviewEvidence(evidence: ReviewEvidence | undefined, catalog: ReviewSource[]) {
  if (!evidence) throw new MarketingWorkflowError('Chạy Review lại để lưu căn cứ và phiên bản nguồn.', 409);
  const current = evidence.sources.map(source => {
    const found = catalog.find(item => item.id === source.id && item.scope === evidence.scope);
    if (!found) throw new MarketingWorkflowError('Nguồn Review không còn thuộc phạm vi được phép. Review lại trước khi duyệt/đăng.', 409);
    return { ...found, data: Object.fromEntries(Object.keys(source.data).map(key => [key, found.data[key]])) };
  });
  if (reviewHash(current) !== evidence.fingerprint) throw new MarketingWorkflowError('Căn cứ Review đã thay đổi. Review và duyệt lại trước khi đăng.', 409);
}
