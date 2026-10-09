import { generateFreeImage } from '@/lib/services/postImages';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** AI vẽ ảnh minh hoạ từ mô tả — chỉ trả ảnh về để xem trước, chưa lưu gì. */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const body = await readJson(request) as { prompt?: unknown };
    const image = await generateFreeImage(typeof body?.prompt === 'string' ? body.prompt : '');
    return new Response(new Uint8Array(image.data), {
      headers: { 'Content-Type': image.mime, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return postsErrorResponse(error);
  }
}
