import type { Pool } from 'pg';
import type { MarketingWorkspace } from '@/lib/types/marketingWorkspace';
import { offerValidAt } from '@/lib/services/marketingBrief';

export async function marketingCommentContext(pageId: string, postId: string, db: Pick<Pool, 'query'>) {
  let row;
  try { row = (await db.query('SELECT document FROM marketing_workspaces WHERE page_id=$1', [pageId])).rows[0]; }
  catch (error) { if ((error as { code?: string }).code === '42P01') return null; throw error; }
  if (!row) return null;
  const state: MarketingWorkspace = typeof row.document === 'string' ? JSON.parse(row.document) : row.document;
  return marketingContextFromWorkspace(state, postId);
}

export function marketingContextFromWorkspace(state: MarketingWorkspace, postId: string, at = Date.now()) {
  const review = state.reviews.find(item => item.externalId === postId || item.publications?.some(publication => publication.externalId === postId));
  const current = review && state.campaigns.find(item => item.id === review.campaignId);
  const campaign = review?.campaignSnapshot ?? current;
  if (!campaign) return null;
  return { knowledge: { ...campaign.knowledge, products: campaign.knowledge.products.filter(product => campaign.productIds.includes(product.id)), emailTriggers: [] },
    context: { campaign: campaign.name, campaignId: campaign.id, accountId: campaign.accountId, version: campaign.version,
      startsAt: campaign.startsAt, endsAt: campaign.endsAt, message: campaign.message, audience: campaign.audience, profile: campaign.profile,
      publicationConfirmed: review?.publication === 'published' || !!review?.publications?.some(item => item.externalId === postId),
      campaignActive: (!campaign.startsAt || Date.parse(campaign.startsAt) <= at) && (!campaign.endsAt || at < Date.parse(campaign.endsAt)),
      originalOffer: campaign.offer.kind !== 'none' ? campaign.offer : null,
      offer: campaign.offer.kind !== 'none' && offerValidAt(campaign, at) ? campaign.offer : null,
      expiredOffer: campaign.offer.kind !== 'none' && !offerValidAt(campaign, at),
      cta: campaign.cta, link: campaign.link, sourceIsCurrent: !!current?.approvedAt && current.version === review!.campaignVersion } };
}
