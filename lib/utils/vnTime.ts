/** Ngày theo lịch Việt Nam dạng YYYY-MM-DD (sv-SE cho đúng định dạng ISO). */
export const vnDay = (at: number | Date = Date.now()): string =>
  new Date(at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
