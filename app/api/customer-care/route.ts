import { AppSecurityError, assertOperationAllowed, requireAppAccess, sameOrigin, withAppAccess } from '@/lib/services/appSecurity';
import { readCustomerOrderHistory } from '@/lib/services/messengerOrders';
import { CustomerCareError, generateCareReply, parseCareProfile, readCarePageProfile, saveCustomerCareSettings } from '@/lib/services/customerCare';
import { InvalidAiKnowledge, parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { readMessengerAiSettings } from '@/lib/services/messengerAi';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { saveConversationMemory } from '@/lib/services/conversationMemory';
import { readConversationSources } from '@/lib/services/conversationSources';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function handle(request: Request) {
  const pageId = process.env.PAGE_ID?.trim();
  if (!pageId || !/^\d{1,64}$/.test(pageId)) return Response.json({ error: 'Chưa cấu hình Fanpage.' }, { status: 503 });
  try {
    if (request.method === 'GET') {
      const [settings, currentPageProfile] = await Promise.all([readMessengerAiSettings(pageId), readCarePageProfile(pageId)]);
      return Response.json({ ...settings, currentPageProfile }, { headers: { 'Cache-Control': 'no-store' } });
    }
    sameOrigin(request);
    const raw = await request.text();
    if (raw.length > 550_000) return Response.json({ error: 'Dữ liệu AI quá lớn.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { throw new CustomerCareError('JSON không hợp lệ.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomerCareError('Yêu cầu không hợp lệ.');
    if (request.method === 'PUT') {
      const actor = await requireAppAccess(request);
      await saveCustomerCareSettings(pageId, body, actor.username);
      return Response.json(await readMessengerAiSettings(pageId));
    }
    if (body.action === 'preview') {
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 8000) throw new CustomerCareError('Nhập tình huống từ 1 đến 8.000 ký tự.');
      const page = await readCarePageProfile(pageId);
      const reply = await generateCareReply(parseAiKnowledge(body.knowledge), parseCareProfile(body.profile), page, body.message.trim());
      return Response.json({ ...reply, pageProfile: page });
    }
    if (body.action !== 'suggest' || typeof body.psid !== 'string' || !/^\d{1,64}$/.test(body.psid)
      || (body.messageId !== undefined && (typeof body.messageId !== 'string' || !body.messageId || body.messageId.length > 500))) throw new CustomerCareError('Hội thoại hoặc tin nhắn không hợp lệ.');
    const settings = await readMessengerAiSettings(pageId);
    if (!settings.profile || !settings.knowledge) throw new CustomerCareError('Xác nhận tri thức và quy tắc Chat trong Cấu hình AI trước khi tạo gợi ý.', 409);
    const db = getMessengerPool();
    const id = JSON.stringify([pageId, body.psid]);
    const latest = (await db.query(`SELECT m.* FROM messenger_messages m JOIN messenger_conversations c ON c.id=m.conversation_id
      WHERE m.page_id=$1 AND m.conversation_id=$2 AND c.hidden_at IS NULL
      AND ($3::text IS NULL OR m.message_id=$3) ORDER BY m.sent_at DESC,m.message_id DESC LIMIT 1`, [pageId, id, body.messageId ?? null])).rows[0];
    if (!latest || latest.direction !== 'in') throw new CustomerCareError('Không có tin khách cần phân tích.', 409);
    const context = (await db.query(`SELECT direction,text FROM messenger_messages WHERE page_id=$1 AND conversation_id=$2
      AND (sent_at<$3 OR (sent_at=$3 AND message_id<$4)) ORDER BY sent_at DESC,message_id DESC LIMIT 10`,
    [pageId, id, latest.sent_at, latest.message_id])).rows.reverse().filter(m => m.text.trim())
      .map(m => ({ role: m.direction === 'in' ? 'user' as const : 'model' as const, text: m.text.slice(0, 2000) }));
    const sources = await readConversationSources(pageId, body.psid, latest.message_id, db);
    if (!sources) throw new CustomerCareError('Hội thoại không còn hiển thị.', 409);
    const history = await readCustomerOrderHistory(pageId, body.psid, db);
    const reply = await generateCareReply(settings.knowledge, settings.profile, settings.pageProfile, latest.text.slice(0, 8000) || '[Tệp đính kèm chưa được đọc]', context, sources, history);
    reply.sourceSummary += ` · Quy tắc Chat ${settings.updatedAt}`;
    if (!latest.text.trim() || latest.attachments_json.length || reply.reply.length > 2000) reply.analysis.canAutoReply = false;
    await assertOperationAllowed();
    if ((await readMessengerAiSettings(pageId)).updatedAt !== settings.updatedAt) throw new CustomerCareError('Quy tắc Chat đã thay đổi. Tạo lại gợi ý theo cấu hình mới.', 409);
    if ((await readConversationSources(pageId, body.psid, latest.message_id, db))?.fingerprint !== sources.fingerprint) throw new CustomerCareError('Nguồn hoặc ưu đãi đã thay đổi. Tạo lại gợi ý trước khi gửi.', 409);
    if (!await saveConversationMemory(pageId, body.psid, latest.message_id, reply)) throw new CustomerCareError('Hội thoại không còn hiển thị. Tải lại trước khi thử lại.', 409);
    return Response.json({ reply, messageId: latest.message_id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof CustomerCareError || error instanceof InvalidAiKnowledge) return Response.json({ error: error.message }, { status: error instanceof CustomerCareError ? error.status : 400 });
    // Authorization errors are handled by withAppAccess, including a session revoked during the request.
    if (error instanceof AppSecurityError) throw error;
    return Response.json({ error: 'Chưa xử lý được Customer Care. Kiểm tra kết nối và migration rồi thử lại.' }, { status: 503 });
  }
}
export const GET = withAppAccess(handle);
export const PUT = withAppAccess(handle);
export const POST = withAppAccess(handle);
