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

/** Bản nháp AI vừa tạo: thêm mô tả ảnh tiếng Anh để AI vẽ ảnh (không lưu vào database). */
export interface GeneratedPostDraft extends PostDraft {
  imagePrompt: string;
}

export type PostImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type PostImageSource = 'ai' | 'upload';

export interface MarketingPost extends PostDraft {
  id: string;
  channel: PostChannel;
  goal: PostGoal;
  productSkus: string[];
  /** Ảnh kèm bài (bytes đọc qua /api/posts/[id]/image); updatedAt để trình duyệt tải lại khi đổi ảnh. */
  image: { source: PostImageSource; updatedAt: number } | null;
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
