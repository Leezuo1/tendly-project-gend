/** Parse JSON và chỉ nhận object thuần; mọi lỗi đổi thành lỗi do caller tạo ra. */
export function parseJsonObject(raw: string, fail: () => Error): Record<string, unknown> {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw fail(); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail();
  return data as Record<string, unknown>;
}
