/** Lịch dịp bán hàng tại Việt Nam để Smart Sourcing gợi ý "sắp tới nên làm gì". Ngày do code tính, AI chỉ đề xuất góc khai thác. */
import { vnDay } from '@/lib/utils/vnTime';
export interface SalesOccasion { name: string; date: string; daysLeft: number; hint: string }

// Ngày âm lịch quy đổi sẵn; hết bảng thì dịp đó tự ẩn thay vì đoán sai ngày.
const LUNAR: Record<string, Record<number, string>> = {
  'Tết Nguyên Đán': { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03' },
  'Tết Trung thu': { 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12' },
};
const HINTS: Record<string, string> = {
  'Tết Dương lịch': 'đón năm mới, tiệc cuối năm, quà tặng',
  'Valentine': 'quà tặng người yêu, cặp đôi',
  'Quốc tế Phụ nữ 8/3': 'quà tặng phụ nữ, mẹ, đồng nghiệp nữ',
  'Valentine Trắng': 'quà đáp lễ, cặp đôi',
  'Lễ 30/4 – 1/5': 'kỳ nghỉ dài, du lịch, khuyến mãi lễ',
  'Quốc tế Thiếu nhi 1/6': 'quà cho bé, gia đình',
  'Ngày của Mẹ': 'quà tặng mẹ',
  'Ngày của Cha': 'quà tặng bố',
  'Quốc khánh 2/9': 'kỳ nghỉ lễ, khuyến mãi',
  'Khai giảng năm học': 'mùa tựu trường, đồ dùng học sinh',
  'Ngày đôi 9/9': 'siêu sale sàn thương mại điện tử',
  'Ngày đôi 10/10': 'siêu sale sàn thương mại điện tử',
  'Phụ nữ Việt Nam 20/10': 'quà tặng phụ nữ',
  'Halloween': 'hóa trang, trang trí, sự kiện',
  'Ngày đôi 11/11': 'siêu sale sàn thương mại điện tử',
  'Nhà giáo Việt Nam 20/11': 'quà tri ân thầy cô',
  'Black Friday': 'giảm giá mạnh cuối năm',
  'Ngày đôi 12/12': 'siêu sale cuối năm',
  'Giáng sinh': 'quà Noel, trang trí, tiệc cuối năm',
  'Tết Nguyên Đán': 'mua sắm Tết, quà biếu, lì xì, trang trí',
  'Tết Trung thu': 'bánh trung thu, đồ chơi, quà biếu',
};
const FIXED: [string, number, number][] = [
  ['Tết Dương lịch', 1, 1], ['Valentine', 2, 14], ['Quốc tế Phụ nữ 8/3', 3, 8], ['Valentine Trắng', 3, 14], ['Lễ 30/4 – 1/5', 4, 30],
  ['Quốc tế Thiếu nhi 1/6', 6, 1], ['Quốc khánh 2/9', 9, 2], ['Khai giảng năm học', 9, 5], ['Ngày đôi 9/9', 9, 9], ['Ngày đôi 10/10', 10, 10],
  ['Phụ nữ Việt Nam 20/10', 10, 20], ['Halloween', 10, 31], ['Ngày đôi 11/11', 11, 11], ['Nhà giáo Việt Nam 20/11', 11, 20],
  ['Ngày đôi 12/12', 12, 12], ['Giáng sinh', 12, 24],
];
const pad = (n: number) => String(n).padStart(2, '0');
/** Chủ nhật/thứ năm thứ n của tháng (weekday: 0 = CN). */
const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + 7 * (n - 1);
};
function occasionsOfYear(year: number): [string, string][] {
  const list: [string, string][] = FIXED.map(([name, month, day]) => [name, `${year}-${pad(month)}-${pad(day)}`]);
  list.push(['Ngày của Mẹ', `${year}-05-${pad(nthWeekday(year, 5, 0, 2))}`]);
  list.push(['Ngày của Cha', `${year}-06-${pad(nthWeekday(year, 6, 0, 3))}`]);
  list.push(['Black Friday', `${year}-11-${pad(nthWeekday(year, 11, 4, 4) + 1)}`]);
  for (const [name, dates] of Object.entries(LUNAR)) if (dates[year]) list.push([name, `${year}-${dates[year]}`]);
  return list;
}

/** Các dịp trong `days` ngày tới (tính cả hôm nay), gần nhất trước. */
export function upcomingOccasions(now = new Date(), days = 90): SalesOccasion[] {
  const today = vnDay(now), start = Date.parse(`${today}T00:00:00Z`), year = Number(today.slice(0, 4));
  return [...occasionsOfYear(year), ...occasionsOfYear(year + 1)]
    .map(([name, date]) => ({ name, date, daysLeft: Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000), hint: HINTS[name] ?? '' }))
    .filter(item => item.daysLeft >= 0 && item.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
/** Ghép tên dịp người dùng chọn với ngày trong lịch; dịp tự nhập (không có trong lịch) giữ ngày trống. */
export function resolveOccasions(names: string[], now = new Date()) {
  const known = upcomingOccasions(now, 366);
  return names.map(name => known.find(item => item.name === name) ?? { name, date: '', daysLeft: -1, hint: '' });
}
