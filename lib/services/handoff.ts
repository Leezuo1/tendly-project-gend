import type { Pool } from 'pg';
import { HANDOFF_REPLY } from '@/lib/services/imageIntake';

/** Mẫu cố định khi AI không trả lời được (khách ngoài chủ đề, nguồn tin chưa rõ…); không do model viết nên không thể lỡ hứa điều gì. */
export const UNKNOWN_REPLY = 'Shop đã nhận được tin nhắn của bạn. Nhân viên sẽ xem và phản hồi bạn sớm nhất có thể nhé.';
// Hằng của mã (không có đầu vào người dùng); nhân đôi dấu nháy cho chắc.
const NOTICE_TEXT = [HANDOFF_REPLY, UNKNOWN_REPLY].map(text => `'${text.replace(/'/g, "''")}'`).join(',');

/**
 * Ca "đang chờ nhân viên": AI chuyển shop một ảnh cần người xem (hàng lỗi, biên lai…). Hội thoại ở lại hàng "Chưa trả lời"
 * dù AI đã gửi tin mẫu báo khách, và chỉ đóng khi có tin gửi đi NÀO KHÁC tin mẫu đó (từ Tendly hay từ hộp thư Messenger qua webhook echo).
 * Tin mẫu nhận ra bằng mã yêu cầu gửi (handoff_request_id, ghi trước khi gửi) HOẶC bằng đúng nội dung mẫu: Meta timeout/5xx, thiếu message_id
 * hay lỗi lưu sau khi gửi thì dòng yêu cầu không có message_id, và echo của tin mẫu không được tính là tin của nhân viên.
 * `alias` là tên hoặc bí danh của bảng messenger_conversations trong câu SQL gọi.
 */
export const handoffOpenSql = (alias: string) => `(${alias}.handoff_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM messenger_messages hm
  JOIN messenger_messages o ON o.page_id=hm.page_id AND o.conversation_id=hm.conversation_id AND o.direction='out' AND o.sent_at>hm.sent_at
  WHERE hm.page_id=${alias}.page_id AND hm.message_id=${alias}.handoff_message_id
  AND o.text NOT IN (${NOTICE_TEXT})
  AND NOT EXISTS (SELECT 1 FROM messenger_outbound_requests r WHERE r.page_id=o.page_id AND r.message_id=o.message_id AND r.request_id=${alias}.handoff_request_id)))`;

/** Đánh dấu tin khách này cần nhân viên; bỏ qua nếu hội thoại đang có một ca chưa đóng (giữ ca cũ). */
export async function markHandoff(db: Pick<Pool, 'query'>, pageId: string, conversationId: string, messageId: string) {
  await db.query(`UPDATE messenger_conversations SET handoff_message_id=$3, handoff_request_id=NULL
    WHERE page_id=$1 AND id=$2 AND NOT ${handoffOpenSql('messenger_conversations')}`, [pageId, conversationId, messageId]);
}

/** Ghi mã yêu cầu của tin mẫu TRƯỚC khi gửi, để echo của nó không bị coi là tin của nhân viên. */
export async function setHandoffRequest(db: Pick<Pool, 'query'>, pageId: string, conversationId: string, messageId: string, requestId: string) {
  await db.query('UPDATE messenger_conversations SET handoff_request_id=$4 WHERE page_id=$1 AND id=$2 AND handoff_message_id=$3', [pageId, conversationId, messageId, requestId]);
}
