import type { SourcingPost } from '@/lib/services/sourcingSearch';
export interface SourcingCriteria {
  industry: string; kind: 'tiktok' | 'suppliers'; keywords: string[]; product: string;
  minPrice: number | null; maxPrice: number | null; currency: 'VND'; unit: string;
  quantity: number | null; maxMoq: number | null; region: string;
  required: string; excluded: string; quality: string; leadTime: string; audience: string;
  resultLimit: number;
}
export interface SourcingPlan {
  queries: string[]; market: 'VN'; language: 'vi'; days: 7; resultLimit: number;
  maxChargeUsd: number; timeoutSeconds: number;
}
export interface SupplierCandidate {
  title: string; url: string; description: string; position: number | null; queries: string[]; verified: false;
  collectedAt: string; source: 'google'; price: null; currency: null; unit: null; moq: null; region: null; leadTime: null;
}
export interface SourcingRun {
  id: string; kind: 'tiktok' | 'suppliers'; status: string; context: Record<string, unknown>;
  result: null | { posts?: SourcingPost[]; candidates?: SupplierCandidate[]; message?: string; duplicateCount?: number; rejectedCount?: number };
  error: string | null; createdAt: number; updatedAt: number;
  analysis?: SourcingAnalysis | null;
}
/** Bài phân tích của AI Smart Sourcing; sources là key của kết quả làm căn cứ. */
export interface SourcingAnalysis {
  summary: string; relevantCount: number;
  findings: { title: string; detail: string; sources: string[] }[];
  productIdeas: { name: string; reason: string; sources: string[] }[];
  caveats: string[]; model: string; createdAt: number;
}
export interface SourcingRequest {
  id: string; revision: number; criteria: SourcingCriteria; plan: SourcingPlan;
  runId: string | null; approvedAt: number | null; updatedAt: number;
  run: SourcingRun | null;
}
export interface SourcingDecision { runId: string; itemKey: string; status: 'shortlist' | 'checked' | 'rejected'; note: string; updatedAt: number; }
export interface SourcingItem {
  key: string; title: string; url: string; text: string; source: string; collectedAt: string;
  metrics?: SourcingPost['metrics']; price: number | null; currency: string | null; unit: string | null; moq: number | null; region: string | null;
}
