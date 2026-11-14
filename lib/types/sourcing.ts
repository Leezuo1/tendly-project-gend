import type { SourcingComment, SourcingPost } from '@/lib/services/sourcingSearch';
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
  /** Nội dung trang (đầu + cuối) do Actor đọc; trống khi không đọc được. */
  page?: string;
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
  /** Báo cáo khám phá sản phẩm 4 phần, chỉ có ở lượt TikTok phân tích từ bản này trở đi. */
  report?: TikTokReport;
  /** Báo cáo tìm nhà cung cấp 4 phần, chỉ có ở lượt Google phân tích từ bản này trở đi. */
  suppliers?: SupplierReport;
}
/** Một nhận định kèm key các bài làm căn cứ; nhận định không có nguồn thật bị loại khi kiểm tra đầu ra AI. */
export interface SourcingPoint { text: string; sources: string[] }
export type TrendStatus = 'early' | 'peaking' | 'saturated' | 'entertainment' | 'unclear';
export interface TikTokReport {
  trend: { status: TrendStatus; reason: string; sources: string[] };
  /** null khi không có bình luận làm căn cứ. */
  buyingIntent: { score: number | null; reason: string; sources: string[] };
  whyNow: SourcingPoint[];
  specs: SourcingPoint[]; audience: SourcingPoint[]; price: SourcingPoint[];
  drivers: SourcingPoint[]; hesitations: SourcingPoint[];
  hooks: SourcingPoint[]; formats: SourcingPoint[]; keywords: SourcingPoint[]; hashtags: string[];
  /** key bài nguồn → tóm tắt nội dung do AI viết. */
  sourceNotes: Record<string, string>;
  commentCount: number;
}
export type SupplierTier = 'factory' | 'wholesale' | 'distributor' | 'unknown';
/** Hồ sơ một nhà cung cấp; source là key kết quả Google chứa thông tin. Chuỗi rỗng = trang không công khai. */
export interface SupplierCard {
  source: string; name: string; tier: SupplierTier; matchScore: number | null;
  moq: string; price: string; strengths: string; phones: string[]; address: string;
  greenFlags: string[]; redFlags: string[]; questions: string[];
}
export interface SupplierReport {
  collected: number; pagesRead: number; filterNote: string;
  tierMix: SourcingPoint[]; regions: SourcingPoint[];
  suppliers: SupplierCard[]; message: string;
}
export interface SourcingRequest {
  id: string; revision: number; criteria: SourcingCriteria; plan: SourcingPlan;
  runId: string | null; approvedAt: number | null; updatedAt: number;
  run: SourcingRun | null;
}
export interface SourcingDecision { runId: string; itemKey: string; status: 'shortlist' | 'checked' | 'rejected'; note: string; updatedAt: number; }
export interface SourcingItem {
  key: string; title: string; url: string; text: string; source: string; collectedAt: string;
  author?: string | null; metrics?: SourcingPost['metrics']; comments?: SourcingComment[]; page?: string; price: number | null; currency: string | null; unit: string | null; moq: number | null; region: string | null;
}
