import type { GeneratedPostDraft } from './posts';

export type ReviewField = keyof GeneratedPostDraft;
export type ReviewStatus = 'unchanged' | 'corrected' | 'needs_input' | 'blocked' | 'failed';
export interface ReviewSource {
  id: string; kind: 'product' | 'faq' | 'brief' | 'voice' | 'offer' | 'proof';
  origin: string; scope: string; version: string; confirmedAt: number | null;
  validFrom: number | null; validUntil: number | null;
  data: Record<string, unknown>;
}
export interface ReviewEvidence {
  scope: string; contentInputHash: string; fingerprint: string; checkedAt: number;
  targetAt?: number;
  sources: ReviewSource[];
}
export interface ReviewChange { field: ReviewField; before: string; after: string; reason: string; sourceIds: string[]; }
export interface ReviewIssue { type: 'missing_source' | 'conflict' | 'unsupported_claim' | 'scope' | 'format' | 'technical'; severity: 'blocking' | 'warning'; field: ReviewField | ''; message: string; sourceIds: string[]; }
export interface ReviewedVariant {
  draftId: string; status: ReviewStatus; original: GeneratedPostDraft; finalDraft: GeneratedPostDraft | null;
  changes: ReviewChange[]; issues: ReviewIssue[];
}
export interface PostReviewResult {
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  variants: ReviewedVariant[]; evidence: ReviewEvidence;
  contentModel: string; reviewModel: string; error?: string;
}
export interface ReviewAttempt extends PostReviewResult {
  id: string; campaignId: string; campaignVersion: number; accountId: string;
  targetPostId?: string; basePostHash?: string; createdAt: number;
  appliedAt?: number; discardedAt?: number;
}
