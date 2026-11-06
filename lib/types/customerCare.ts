import type { AiProfile } from '@/lib/services/aiConfiguration';
import type { AiKnowledge } from './ai';

export interface CarePageProfile { name: string; address: string; tone: string; examples: string; }
export interface CustomerCareSettings {
  autoReply: boolean;
  updatedAt: number | null;
  profile: AiProfile | null;
  pageProfile: CarePageProfile | null;
  pageAssigned: boolean;
  pageEnabled: boolean;
  approvedBy: string;
  approvedAt: number | null;
  knowledge: AiKnowledge | null;
}

export interface CareSource {
  id: string;
  kind: 'post' | 'live';
  postId: string | null;
  commentId: string;
  linkedAt: number;
  commentText: string;
  postText: string;
  products: { id: string; sku: string; name: string }[];
  campaign: null | {
    id: string; name: string; version: number; message: string;
    startsAt: string; endsAt: string;
    offerActive: boolean;
    offer: null | { details: string; conditions: string; startsAt: string; endsAt: string };
  };
  live: null | {
    id: string; title: string; status: 'live' | 'ended'; sourceKind: string | null;
    startedAt: number; endedAt: number | null; sku: string | null;
    flashPrice: number | null; flashActive: boolean;
  };
  issues: string[];
}
export interface CareSourceContext {
  resolution: 'none' | 'linked' | 'reply' | 'ambiguous' | 'unresolved';
  selectedId: string | null;
  sources: CareSource[];
  blocked: boolean;
  fingerprint: string;
}
