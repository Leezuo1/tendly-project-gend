import type { AiKnowledge } from './ai';
import type { AiConfiguration } from '@/lib/services/aiConfiguration';
import type { GeneratedPostDraft, MarketingPost } from './posts';

export type MarketingPlatform = 'facebook' | 'instagram' | 'tiktok' | 'shopee';
export interface MarketingAccount {
  id: string; name: string; platform: MarketingPlatform; mock: boolean;
}
export interface MarketingProfile {
  name: string; purpose: string; audience: string; pain: string; address: string; tone: string;
  approach: string; format: string; cta: string; avoid: string; examples: string;
}
export interface CampaignBrief {
  name: string; accountId: string; goal: string; productIds: string[]; audience: string; pain: string;
  message: string; benefits: string; barriers: string; tone: string; format: string; cta: string;
  link: string; startsAt: string; endsAt: string; notes: string;
  offer: { kind: 'none' | 'discount' | 'voucher' | 'gift' | 'combo' | 'shipping'; details: string; conditions: string; startsAt: string; endsAt: string; confirmed: boolean };
  proof: string; proofSource: string;
}
export interface MarketingCampaign extends CampaignBrief {
  id: string; version: number; approvedAt: number | null; approvedBy: string;
  knowledge: AiKnowledge; configuration: AiConfiguration; profile: MarketingProfile;
}
export interface ReviewedMarketingPost {
  postId: string; campaignId: string; campaignVersion: number; accountId: string;
  original: GeneratedPostDraft; changes: string[]; reviewHash: string; reviewedAt: number;
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
  profiles: Record<string, MarketingProfile>; campaigns: MarketingCampaign[];
  reviews: ReviewedMarketingPost[]; schedules: MarketingSchedule[];
}
export interface MarketingWorkspaceView {
  revision: number; workspace: MarketingWorkspace; posts: MarketingPost[]; accounts: MarketingAccount[];
}
