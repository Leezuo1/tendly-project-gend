// ============================================================
// DOMAIN TYPES — AI soạn & đăng bài marketing
// ============================================================

export type PostChannel = 'facebook' | 'tiktok' | 'email';
export type PostGoal = 'new-product' | 'promotion' | 'clearance' | 'restock' | 'engagement';
export type PostTone = 'friendly' | 'youthful' | 'luxury' | 'funny';
export type PostStatus = 'draft' | 'published';

/** Yêu cầu tạo bài: chủ shop chọn trên giao diện, server kiểm tra lại trước khi gọi AI. */
export interface PostGenerationRequest {
  channel: PostChannel;
  goal: PostGoal;
  tone: PostTone;
  productIds: string[];
  notes: string;
  brandVoice: string;
  variants: number;
}

/** Một phương án bài viết AI trả về — chỉ là bản nháp, chủ shop sửa trước khi đăng. */
export interface PostDraft {
  title: string;
  content: string;
  hashtags: string[];
  imageIdea: string;
}

export interface MarketingPost extends PostDraft {
  id: string;
  channel: PostChannel;
  goal: PostGoal;
  productSkus: string[];
  status: PostStatus;
  externalId: string | null;
  externalUrl: string | null;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface NewMarketingPost extends PostDraft {
  channel: PostChannel;
  goal: PostGoal;
  productSkus: string[];
}
