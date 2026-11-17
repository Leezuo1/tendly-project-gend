import type { Pool } from 'pg';
import { nextStaffLabels, type StaffLabelAction } from '@/lib/services/contextTagRules';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { readShopTagRules } from '@/lib/services/shopCatalog';
import type { ContextTagRule } from '@/lib/types/contextTags';
import type { StaffLabels } from '@/lib/types/inbox';

export class StaffLabelsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const TYPES: StaffLabelAction['type'][] = ['add', 'removeStaff', 'hideRule'];

/** Một thao tác của nhân viên ({ type, id }); máy khách chỉ gửi thao tác, không gửi cả trạng thái nhãn. */
export function parseStaffLabelAction(input: unknown): StaffLabelAction {
  const action = input as Partial<StaffLabelAction> | null;
  if (!action || typeof action !== 'object' || !TYPES.includes(action.type as StaffLabelAction['type'])
    || typeof action.id !== 'string' || !action.id || action.id.length > 100) throw new StaffLabelsError('Thao tác nhãn không hợp lệ.');
  return { type: action.type as StaffLabelAction['type'], id: action.id };
}

export function storedStaffLabels(value: unknown): StaffLabels {
  const row = value as Partial<StaffLabels> | null;
  const list = (items: unknown) => Array.isArray(items) ? items.filter((id): id is string => typeof id === 'string') : [];
  return { added: list(row?.added), hidden: list(row?.hidden) };
}

/** Nhãn nhân viên dán còn trong bộ nhãn (tên và ngữ cảnh), theo thứ tự đã dán. */
export function staffLabelNotes(value: unknown, rules: ContextTagRule[]): { label: string; context?: string }[] {
  return storedStaffLabels(value).added.flatMap(id => rules.filter(rule => rule.id === id).map(rule => ({ label: rule.label, ...(rule.context ? { context: rule.context } : {}) })));
}

/**
 * Áp một thao tác lên nhãn đang lưu của hội thoại, theo bộ nhãn hiện hành của shop trên máy chủ.
 * Hai máy sửa cùng lúc không ghi đè nhau: mỗi lần chỉ đổi đúng một nhãn, ghi có so sánh với bản vừa đọc.
 */
export async function saveStaffLabels(pageId: string, psid: string, input: unknown, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<StaffLabels> {
  const action = parseStaffLabelAction(input);
  const id = JSON.stringify([pageId, psid]);
  const rules = await readShopTagRules(pageId, db);
  // Nhãn vừa tạo trong Cài đặt được đồng bộ sau khoảng 1 giây; báo thử lại thay vì lưu id máy chủ chưa biết.
  if (action.type === 'add' && !rules.some(rule => rule.id === action.id)) throw new StaffLabelsError('Nhãn mới chưa đồng bộ, thử lại sau vài giây.', 409);
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = (await db.query('SELECT staff_labels FROM messenger_conversations WHERE page_id=$1 AND id=$2 AND hidden_at IS NULL', [pageId, id])).rows[0];
    if (!row) throw new StaffLabelsError('Hội thoại không còn hiển thị.', 404);
    const current = storedStaffLabels(row.staff_labels), next = nextStaffLabels(current, action, rules);
    const saved = await db.query(`UPDATE messenger_conversations SET staff_labels=$3::jsonb WHERE page_id=$1 AND id=$2 AND hidden_at IS NULL AND staff_labels=$4::jsonb
      RETURNING staff_labels`, [pageId, id, JSON.stringify(next), JSON.stringify(row.staff_labels)]);
    if (saved.rows[0]) return storedStaffLabels(saved.rows[0].staff_labels);
  }
  throw new StaffLabelsError('Nhãn vừa được sửa ở nơi khác. Thử lại.', 409);
}
