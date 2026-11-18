// Ảnh khách gửi trên Messenger: tải về để AI xem (chỉ trên máy chủ). Byte ảnh chỉ nằm trong bộ nhớ lúc gọi Gemini,
// không lưu database hay log: ảnh biên lai, giấy tờ có thể chứa dữ liệu nhạy cảm.
import { IMAGE_KINDS, type AiMessageAnalysis, type ImageKind } from '@/lib/types/ai';
import type { MessengerAttachment } from '@/lib/types/messenger';

export interface MessageImage { mimeType: string; data: string }
/** Ảnh của một lượt trả lời. `unreadable`: có ảnh không tải được hoặc vi phạm giới hạn, nên không gọi model. */
export interface ImageInput { images: MessageImage[]; unreadable: boolean; count: number; hasText: boolean }

const MAX_IMAGES = 3;
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Host của Meta; so khớp theo ranh giới dấu chấm để `evilfbcdn.net` không lọt.
const TRUSTED_DOMAINS = ['fbcdn.net', 'fbsbx.com'];

const trustedHost = (hostname: string) => TRUSTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));

/** Ảnh thật khách gửi: không phải sticker/Like, có đường dẫn https. */
export function isReadableImage(attachment: MessengerAttachment): boolean {
  return attachment.type === 'image' && !attachment.sticker && typeof attachment.url === 'string' && attachment.url.startsWith('https://');
}

async function loadOne(url: string, transport: typeof fetch): Promise<MessageImage | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !trustedHost(parsed.hostname.toLowerCase())) return null;
    const response = await transport(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!response.ok || !MIME_TYPES.includes(mimeType) || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) return null;
    const body = Buffer.from(await response.arrayBuffer());
    return body.length > 0 && body.length <= MAX_BYTES ? { mimeType, data: body.toString('base64') } : null;
  } catch { return null; }
}

/** Tải song song; một ảnh hỏng hoặc quá 3 ảnh thì cả lượt coi là không đọc được. */
export async function loadMessageImages(attachments: MessengerAttachment[], transport: typeof fetch = fetch): Promise<{ images: MessageImage[]; unreadable: boolean }> {
  const readable = attachments.filter(isReadableImage);
  if (readable.length !== attachments.length || readable.length > MAX_IMAGES) return { images: [], unreadable: true };
  const loaded = await Promise.all(readable.map(attachment => loadOne(attachment.url!, transport)));
  return loaded.every(Boolean) ? { images: loaded as MessageImage[], unreadable: false } : { images: [], unreadable: true };
}

/** undefined = không đi đường ảnh (không có attachment, hoặc có attachment không phải ảnh đọc được: giữ chờ nhân viên như cũ). */
export async function buildImageInput(attachments: MessengerAttachment[], text: string, transport: typeof fetch = fetch): Promise<ImageInput | undefined> {
  if (!attachments.length || !attachments.every(isReadableImage)) return undefined;
  return { ...await loadMessageImages(attachments, transport), count: attachments.length, hasText: !!text.trim() };
}

export { IMAGE_KINDS, type ImageKind };

/** Hành động theo loại ảnh. Sau này tự xử lý một loại (ví dụ defect mở phiếu đổi trả): đổi hành động của loại đó, không đụng schema hay prompt. */
export const IMAGE_KIND_ACTIONS: Record<ImageKind, 'answer' | 'handoff' | 'decline'> = {
  product: 'answer', defect: 'handoff', receipt: 'handoff', other_support: 'handoff', unrelated: 'decline',
};
// Mẫu cố định, không do model viết nên không thể lỡ hứa điều gì.
export const HANDOFF_REPLY = 'Shop đã nhận được hình ảnh của bạn. Nhân viên sẽ kiểm tra và phản hồi bạn sớm nhất có thể nhé.';
export const DECLINE_REPLY = 'Mình chưa xử lý được hình ảnh này. Bạn mô tả bằng tin nhắn hoặc gửi ảnh sản phẩm bạn quan tâm giúp shop nhé.';

/** Kết quả xử lý của cả lượt ảnh. Loại thiếu, thừa hoặc sai giá trị thì chuyển shop (chặn an toàn). */
export function imageOutcome(kinds: unknown, count: number, hasText: boolean): 'answer' | 'handoff' | 'decline' {
  if (!Array.isArray(kinds) || kinds.length !== count || !kinds.every(kind => (IMAGE_KINDS as readonly unknown[]).includes(kind))) return 'handoff';
  const actions = (kinds as ImageKind[]).map(kind => IMAGE_KIND_ACTIONS[kind]);
  if (actions.includes('handoff')) return 'handoff';
  return !hasText && actions.every(action => action === 'decline') ? 'decline' : 'answer';
}

/** Thay câu trả lời bằng mẫu cố định và đặt cờ; mẫu an toàn nên `canAutoReply` đúng (vẫn qua công tắc tự trả lời). */
export function applyImageOutcome(result: { reply: string; analysis: AiMessageAnalysis }, outcome: 'handoff' | 'decline'): void {
  result.reply = outcome === 'handoff' ? HANDOFF_REPLY : DECLINE_REPLY;
  result.analysis = outcome === 'handoff'
    ? { ...result.analysis, imageOutcome: outcome, canAutoReply: true, needsHuman: true, priority: 'high', priorityScore: Math.max(80, result.analysis.priorityScore),
      reason: 'Khách gửi ảnh cần nhân viên xem (hàng lỗi, biên lai hoặc chưa rõ).' }
    : { ...result.analysis, imageOutcome: outcome, canAutoReply: true, needsHuman: false, priority: 'low', reason: 'Ảnh không liên quan đến shop; trả lời bằng mẫu.' };
}

/** Không đọc được ảnh: chuyển shop mà không gọi model. */
export function unreadableImageResult() {
  const result = { reply: '', model: 'none', sourceSummary: '',
    analysis: { sentiment: 'neutral', emotion: 'neutral', priority: 'normal', priorityScore: 40, reason: 'Không đọc được ảnh khách gửi.', needsHuman: false } as AiMessageAnalysis };
  applyImageOutcome(result, 'handoff');
  result.analysis.reason = 'Không đọc được ảnh khách gửi; cần nhân viên xem.';
  return result;
}
