import { withAppAccess } from '@/lib/services/appSecurity';
import { after } from 'next/server';
import { requireDashboardKey } from '@/lib/services/postsApi';
import { syncFacebookComments } from '@/lib/services/facebookCommentSync';
import { InvalidMarketingRequest, marketingErrorResponse, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { draftCommentReply, FacebookCommentError, processPendingComments, readFacebookComments,
  saveCommentSettings, sendCommentPrivateReply } from '@/lib/services/facebookComments';

export const runtime = 'nodejs';
export const maxDuration = 60;

function errorResponse(error: unknown) {
  return error instanceof FacebookCommentError
    ? Response.json({ error: error.message }, { status: error.status }) : marketingErrorResponse(error);
}

export const GET = withAppAccess(async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    return Response.json(await readFacebookComments(marketingPageId()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
});

export const PUT = withAppAccess(async function PUT(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const body = await readMarketingJson(request);
    if (typeof body.autoReply !== 'boolean') throw new InvalidMarketingRequest('Chế độ tự gửi không hợp lệ.');
    if (!body.autoReply && body.knowledge === undefined) {
      await getMessengerPool().query('UPDATE facebook_comment_settings SET auto_reply=false WHERE page_id=$1', [pageId]);
      return Response.json({ saved: true });
    }
    await saveCommentSettings(pageId, body.autoReply, parseAiKnowledge(body.knowledge));
    return Response.json({ saved: true });
  } catch (error) { return errorResponse(error); }
});

export const POST = withAppAccess(async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const body = await readMarketingJson(request);
    if (body.action === 'sync') {
      const sync = await syncFacebookComments(pageId);
      const data = await readFacebookComments(pageId);
      if (!sync.error && data.pending && data.settings.updatedAt) after(async () => {
        try { await processPendingComments(pageId); }
        catch { console.error('Facebook comment processing deferred; comments remain in the database.'); }
      });
      return Response.json({ ...data, sync }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'process') {
      await processPendingComments(pageId);
      return Response.json({ processed: true });
    }
    if (typeof body.commentId !== 'string' || !/^\d{1,64}_\d{1,64}$/.test(body.commentId)) {
      throw new InvalidMarketingRequest('Mã bình luận không hợp lệ.');
    }
    if (body.action === 'draft') {
      const processed = await draftCommentReply(pageId, body.commentId);
      if (!processed) throw new FacebookCommentError('Bình luận đang xử lý hoặc không thể phân tích lại.');
      return Response.json({ processed });
    }
    if (body.action !== 'send' || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000 ||
        typeof body.revision !== 'number' || !Number.isSafeInteger(body.revision) || body.revision < 1) {
      throw new InvalidMarketingRequest('Nội dung nhắn riêng không hợp lệ (tối đa 2000 ký tự).');
    }
    return Response.json(await sendCommentPrivateReply(pageId, body.commentId, body.text.trim(), body.revision));
  } catch (error) { return errorResponse(error); }
});
