/** Đọc thân yêu cầu của POST /api/messenger/send: chữ (JSON), ảnh sản phẩm theo mã (JSON) hoặc ảnh từ máy (multipart). */
import type { PostImageMime } from '@/lib/types/posts';
import { MessengerSendError } from '@/lib/services/messengerSend';
import { checkPostImage, InvalidPostImage, MAX_IMAGE_BYTES } from '@/lib/services/postImages';

export type SendRequest = { psid: string; requestId: string } & (
  | { kind: 'text'; text: string }
  | { kind: 'product'; imageId: string }
  | { kind: 'file'; data: Uint8Array; mime: PostImageMime });

const PSID = /^\d{1,64}$/, UUID = /^[a-f0-9-]{36}$/i;
const bad = (message: string, status = 400) => new MessengerSendError(message, status);
const TOO_BIG = 'Ảnh lớn quá 4MB, chọn ảnh nhỏ hơn nhé.';

export async function parseSendRequest(request: Request): Promise<SendRequest> {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    // Chặn sớm theo content-length (Vercel cũng giới hạn thân ~4,5 MB), rồi kiểm lại kích thước thật.
    if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 4096) throw bad(TOO_BIG, 413);
    let form: FormData;
    try { form = await request.formData(); } catch { throw bad('Yêu cầu ảnh không hợp lệ.'); }
    const psid = form.get('psid'), requestId = form.get('requestId'), file = form.get('file');
    if (typeof psid !== 'string' || !PSID.test(psid) || typeof requestId !== 'string' || !UUID.test(requestId) || typeof file === 'string' || !file) {
      throw bad('Cần khách hợp lệ, một ảnh và request ID.');
    }
    if (file.size > MAX_IMAGE_BYTES) throw bad(TOO_BIG, 413);
    const data = new Uint8Array(await file.arrayBuffer());
    try { return { kind: 'file', psid, requestId, data, mime: checkPostImage(data) }; }
    catch (error) { throw bad(error instanceof InvalidPostImage ? error.message : 'Ảnh không hợp lệ.'); }
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16000) throw bad('Yêu cầu quá dài.', 413);
    body = JSON.parse(raw);
  } catch (error) { throw error instanceof MessengerSendError ? error : bad('JSON không hợp lệ.'); }
  if (!body || typeof body.psid !== 'string' || !PSID.test(body.psid) || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) {
    throw bad('Cần khách hợp lệ, nội dung 1–2.000 ký tự và request ID.');
  }
  const { psid, requestId } = body;
  if (body.imageId !== undefined) {
    if (body.text !== undefined || typeof body.imageId !== 'string' || !UUID.test(body.imageId)) throw bad('Cần đúng một trong hai: nội dung chữ hoặc mã ảnh hợp lệ.');
    return { kind: 'product', psid, requestId, imageId: body.imageId };
  }
  if (typeof body.text !== 'string' || !body.text.trim() || Array.from(body.text).length > 2000) {
    throw bad('Cần khách hợp lệ, nội dung 1–2.000 ký tự và request ID.');
  }
  return { kind: 'text', psid, requestId, text: body.text.trim() };
}
