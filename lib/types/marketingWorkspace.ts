import type { AiKnowledge } from './ai';
import type { AiConfiguration } from '@/lib/services/aiConfiguration';
import type { GeneratedPostDraft, MarketingPost } from './posts';
import type { PostReviewResult, ReviewAttempt } from './postReview';

export type MarketingPlatform = 'facebook' | 'instagram' | 'tiktok' | 'shopee';
export interface MarketingAccount {
  id: string; name: string; platform: MarketingPlatform; mock: boolean;
}
export interface MarketingProfile {
  name: string; purpose: string; audience: string; pain: string; address: string; tone: string;
  approach: string; format: string; cta: string; avoid: string; examples: string;
  /** Bài viết mẫu do shop cung cấp; AI Review so sánh giọng/cấu trúc bài mới với các bài này. Hồ sơ cũ có thể chưa có. */
  samples?: string[];
}
export interface CampaignBrief {
  name: string; accountId: string; goal: string; productIds: string[]; audience: string; pain: string;
  message: string; benefits: string; barriers: string; tone: string; format: string; cta: string;
  link: string; startsAt: string; endsAt: string; notes: string;
  offer: { kind: 'none' | 'discount' | 'voucher' | 'gift' | 'combo' | 'shipping'; details: string; conditions: string; startsAt: string; endsAt: string; confirmed: boolean };
  proof: string; proofSource: string;
}
export interface MarketingCampaign extends CampaignBrief {
  sourcing?: { runId: string; itemKey: string };
  id: string; version: number; approvedAt: number | null; approvedBy: string;
  knowledge: AiKnowledge; configuration: AiConfiguration; profile: MarketingProfile;
}
export interface ReviewedMarketingPost {
  plan?: MarketingPlanBinding;
  outlineSnapshot?: { title: string; outline: string; pillar: string };
  postId: string; campaignId: string; campaignVersion: number; accountId: string;
  original: GeneratedPostDraft; changes: string[]; reviewHash: string; reviewedAt: number;
  review?: PostReviewResult;
  campaignSnapshot?: MarketingCampaign;
  publications?: { externalId: string; externalUrl: string | null; at: number }[];
  approvedHash: string | null; approvedAt: number | null; approvedBy: string;
  publication: 'draft' | 'publishing' | 'published' | 'unknown'; externalId?: string; externalUrl?: string;
}
export interface MarketingScheduleSlot {
  id: string; postId: string; at: number; approvedHash: string;
  status: 'scheduled' | 'publishing' | 'published' | 'blocked' | 'unknown' | 'missed'; message: string;
}
export interface MarketingSchedule {
  id: string; name: string; scenario: string; timezone: 'Asia/Ho_Chi_Minh';
  status: 'draft' | 'approved' | 'active' | 'paused' | 'cancelled'; approvedAt: number | null; approvedBy: string;
  slots: MarketingScheduleSlot[];
}
export interface MarketingWorkspace {
  contentPlans?: MarketingContentPlan[];
  reviewAttempts?: ReviewAttempt[];
  profiles: Record<string, MarketingProfile>; campaigns: MarketingCampaign[];
  reviews: ReviewedMarketingPost[]; schedules: MarketingSchedule[];
}
export interface MarketingPlanBinding { id: string; version: number; itemId: string; }
export interface MarketingPlanItem { id: string; pillarIndex: number; title: string; outline: string; }
export interface MarketingContentPlan {
  id: string; campaignId: string; campaignVersion: number; version: number;
  contentModel: string;
  pillars: { name: string; objective: string }[]; items: MarketingPlanItem[];
  review?: PostReviewResult; approvedAt: number | null; approvedBy: string;
}
export interface MarketingWorkspaceView {
  revision: number; workspace: MarketingWorkspace; posts: MarketingPost[]; accounts: MarketingAccount[];
}
