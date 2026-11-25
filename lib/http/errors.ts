type Ctor<E extends Error> = abstract new (...args: never[]) => E;
export type ErrorRule = readonly [Ctor<Error>, (error: never) => Response];

export function errorJson(message: string, status: number, extra: { code?: string; noStore?: boolean } = {}): Response {
  return Response.json({ error: message, ...(extra.code ? { code: extra.code } : {}) },
    { status, ...(extra.noStore ? { headers: { 'Cache-Control': 'no-store' } } : {}) });
}

/** Gắn kiểu lỗi với hàm tạo response; `e` được suy ra từ lớp lỗi. */
export const rule = <E extends Error>(ctor: Ctor<E>, to: (error: E) => Response): ErrorRule => [ctor, to];

/** Response của rule khớp đầu tiên; không rule nào khớp thì undefined để caller tự xử lý phần còn lại. */
export function mapError(error: unknown, rules: readonly ErrorRule[]): Response | undefined {
  for (const [ctor, to] of rules) if (error instanceof ctor) return to(error as never);
}

/** Postgres 42P01: bảng chưa được tạo vì chưa chạy migration. */
export const isMissingTable = (error: unknown): boolean => (error as { code?: unknown })?.code === '42P01';
