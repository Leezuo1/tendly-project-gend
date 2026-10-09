/** Ảnh kèm bài đăng: kiểm tra file ảnh và tạo ảnh AI miễn phí qua Pollinations (không cần API key). */
import type { PostImageMime } from '@/lib/types/posts';

/** Vercel giới hạn body request ~4,5MB; trình duyệt đã nén ảnh trước khi gửi nên 4MB là dư. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 600;

export class InvalidPostImage extends Error {}
export class ImageGenerationFailed extends Error {}

/** Nhận diện ảnh theo magic bytes, không tin Content-Type do client gửi. */
export function sniffImageMime(bytes: Uint8Array): PostImageMime | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function checkPostImage(bytes: Uint8Array): PostImageMime {
  if (!bytes.length) throw new InvalidPostImage('Chưa có dữ liệu ảnh.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new InvalidPostImage('Ảnh lớn quá 4MB, chọn ảnh nhỏ hơn nhé.');
  const mime = sniffImageMime(bytes);
  if (!mime) throw new InvalidPostImage('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
  return mime;
}

/** Ghép mô tả của AI với phong cách ảnh sản phẩm; ảnh đăng Fanpage không nên có chữ (AI vẽ chữ hay sai). */
export function buildImagePrompt(description: string): string {
  const subject = description.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT_LENGTH);
  if (!subject) throw new InvalidPostImage('Chưa có mô tả ảnh để AI tạo.');
  return `${subject}. Professional e-commerce product photography, natural soft lighting, clean composition, high detail, no text, no watermark, no logo.`;
}

export async function generateFreeImage(
  description: string, transport: typeof fetch = fetch,
): Promise<{ data: Buffer; mime: PostImageMime }> {
  const prompt = buildImagePrompt(description);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&safe=true&seed=${seed}`;

  let res: Response;
  try {
    res = await transport(url, { signal: AbortSignal.timeout(50_000) });
  } catch {
    throw new ImageGenerationFailed('Dịch vụ tạo ảnh đang chậm hoặc không kết nối được. Thử lại sau ít phút nhé.');
  }
  if (!res.ok) throw new ImageGenerationFailed('Dịch vụ tạo ảnh miễn phí đang bận. Thử lại sau ít phút nhé.');
  const data = Buffer.from(await res.arrayBuffer());
  const mime = sniffImageMime(data);
  if (!mime || data.length > MAX_IMAGE_BYTES) throw new ImageGenerationFailed('Dịch vụ tạo ảnh trả về dữ liệu không phải ảnh. Thử lại nhé.');
  return { data, mime };
}
