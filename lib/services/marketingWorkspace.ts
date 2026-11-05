import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { createPost, getPost, getPostImage, listPosts, markPublished, updateDraft, setPostImage, deletePostImage, type StoredPostImage } from '@/lib/services/postsPostgres';
import { publishToFacebookPage } from '@/lib/services/facebookPage';
import { composePostMessage, parsePostEdit } from '@/lib/services/aiPost';
import { assertOperationAllowed, runAutomaticAccess } from '@/lib/services/appSecurity';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { parseAiConfiguration } from '@/lib/services/aiConfiguration';
import { generateReviewedMarketing } from '@/lib/services/aiPostReview';
import { emptyMarketingProfile, emptyMarketingWorkspace, marketingText, MarketingWorkflowError, MARKETING_POST_GOALS, offerValidAt, parseCampaignBrief, parseMarketingProfile, requireCampaignReady } from '@/lib/services/marketingBrief';
import type { MarketingAccount, MarketingCampaign, MarketingSchedule, MarketingWorkspace, MarketingWorkspaceView, ReviewedMarketingPost } from '@/lib/types/marketingWorkspace';
import type { GeneratedPostDraft, MarketingPost } from '@/lib/types/posts';

export function marketingAccounts(pageId: string): MarketingAccount[] {
  return [{ id: pageId, name: 'Fanpage Facebook', platform: 'facebook', mock: false },
    { id: 'sample-instagram', name: 'Instagram · Kênh mẫu', platform: 'instagram', mock: true },
    { id: 'sample-tiktok', name: 'TikTok · Kênh mẫu', platform: 'tiktok', mock: true },
    { id: 'sample-shopee', name: 'Shopee · Kênh mẫu', platform: 'shopee', mock: true }];
}
const document = (value: unknown): MarketingWorkspace => typeof value === 'string' ? JSON.parse(value) : value as MarketingWorkspace;
export async function readMarketingWorkspace(pageId: string, db = getMessengerPool()) {
  const row = (await db.query('SELECT revision,document FROM marketing_workspaces WHERE page_id=$1', [pageId])).rows[0];
  return { revision: Number(row?.revision ?? 0), workspace: row ? document(row.document) : emptyMarketingWorkspace() };
}
export async function marketingWorkspaceView(pageId: string): Promise<MarketingWorkspaceView> {
  const [state, posts] = await Promise.all([readMarketingWorkspace(pageId), listPosts()]);
  return { ...state, posts, accounts: marketingAccounts(pageId) };
}
async function changeWorkspace<T>(pageId: string, revision: number | undefined, fn: (state: MarketingWorkspace, db: PoolClient) => Promise<T>) {
  const db = await getMessengerPool().connect();
  try {
    await db.query('BEGIN');
    await db.query('INSERT INTO marketing_workspaces(page_id,document,updated_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(page_id) DO NOTHING', [pageId, JSON.stringify(emptyMarketingWorkspace()), Date.now()]);
    const row = (await db.query('SELECT revision,document FROM marketing_workspaces WHERE page_id=$1 FOR UPDATE', [pageId])).rows[0];
    if (revision !== undefined && Number(row.revision) !== revision) throw new MarketingWorkflowError('Dữ liệu đã thay đổi. Tải lại trước khi lưu để tránh ghi đè.', 409);
    const state = document(row.document);
    const result = await fn(state, db);
    await db.query('UPDATE marketing_workspaces SET document=$2::jsonb,revision=revision+1,updated_at=$3 WHERE page_id=$1', [pageId, JSON.stringify(state), Date.now()]);
    await db.query('COMMIT'); return result;
  } catch (e) { await db.query('ROLLBACK'); throw e; }
  finally { db.release(); }
}
export const marketingPostHash = (post: MarketingPost) => createHash('sha256').update(JSON.stringify([post.title, post.content, post.hashtags, post.imageIdea, post.image])).digest('hex');
function findCampaign(state: MarketingWorkspace, id: unknown) {
  const campaign = state.campaigns.find(item => item.id === id);
  if (!campaign) throw new MarketingWorkflowError('Không tìm thấy chiến dịch.', 404);
  return campaign;
}
function findReview(state: MarketingWorkspace, id: unknown) {
  const review = state.reviews.find(item => item.postId === id);
  if (!review) throw new MarketingWorkflowError('Bài chưa thuộc luồng duyệt Marketing.', 404);
  return review;
}
function requireCurrentCampaign(state: MarketingWorkspace, review: ReviewedMarketingPost) {
  const campaign = findCampaign(state, review.campaignId);
  if (!campaign.approvedAt || review.campaignVersion !== campaign.version) throw new MarketingWorkflowError('Brief đã thay đổi hoặc chưa được duyệt. Tạo/kiểm tra lại bài theo brief mới.', 409);
  return campaign;
}
function invalidatePostSchedules(state: MarketingWorkspace, postIds: string[]) {
  for (const schedule of state.schedules) {
    if (schedule.status === 'cancelled' || !schedule.slots.some(slot => slot.status === 'scheduled' && postIds.includes(slot.postId))) continue;
    schedule.status = 'paused'; schedule.approvedAt = null;
    for (const slot of schedule.slots.filter(item => item.status === 'scheduled' && postIds.includes(item.postId))) slot.message = 'Bài/brief đã thay đổi. Lập lịch mới và duyệt lại.';
  }
}
export function requireApprovedMarketingPost(state: MarketingWorkspace, post: MarketingPost, at = Date.now()) {
  const review = findReview(state, post.id);
  const campaign = requireCurrentCampaign(state, review);
  const hash = marketingPostHash(post);
  if (review.reviewHash !== hash || review.approvedHash !== hash || !review.approvedAt) throw new MarketingWorkflowError('Bài/ảnh chưa được Review và chủ shop duyệt đúng phiên bản.', 409);
  if (!offerValidAt(campaign, at) || (campaign.endsAt && at >= Date.parse(campaign.endsAt))) throw new MarketingWorkflowError('Ưu đãi hoặc chiến dịch không còn hiệu lực tại giờ đăng.');
  return { review, campaign, hash };
}

export async function marketingWorkspaceAction(pageId: string, actor: string, revision: number, action: string, input: Record<string, unknown>) {
  const accounts = marketingAccounts(pageId);
  // AI runs outside the transaction; the revision check prevents overwriting newer edits.
  if (action === 'generate' || action === 'review') {
    const current = await readMarketingWorkspace(pageId);
    if (current.revision !== revision) throw new MarketingWorkflowError('Tải lại dữ liệu trước khi tạo bài.', 409);
    const previous = action === 'review' ? findReview(current.workspace, input.postId) : undefined;
    const campaign = findCampaign(current.workspace, previous?.campaignId ?? input.campaignId);
    if (!campaign.approvedAt) throw new MarketingWorkflowError('Duyệt brief trước khi soạn hoặc kiểm tra nội dung.');
    requireCampaignReady(campaign);
    const account = accounts.find(item => item.id === campaign.accountId)!;
    const post = previous ? await getPost(previous.postId) : undefined;
    if (previous?.publication !== undefined && previous.publication !== 'draft') throw new MarketingWorkflowError('Không sửa bài đã đăng hoặc đang được gửi.');
    const original: GeneratedPostDraft | undefined = post ? { title: post.title, content: post.content, hashtags: post.hashtags, imageIdea: post.imageIdea, imagePrompt: '' } : undefined;
    const results = await generateReviewedMarketing(campaign, account, original);
    await changeWorkspace(pageId, revision, async (state, db) => {
      if (!previous && state.reviews.length >= 100) throw new MarketingWorkflowError('Tối đa 100 bài theo chiến dịch.');
      for (const result of results) {
        const final = previous ? await updateDraft(previous.postId, result.final, db) : await createPost({ ...result.final, channel: account.mock ? 'tiktok' : 'facebook', goal: MARKETING_POST_GOALS[campaign.goal], productSkus: campaign.knowledge.products.filter(item => campaign.productIds.includes(item.id)).map(item => item.sku) }, db);
        const record: ReviewedMarketingPost = { postId: final.id, campaignId: campaign.id, campaignVersion: campaign.version, accountId: account.id, original: result.original, changes: result.changes,
          reviewHash: marketingPostHash(final), reviewedAt: Date.now(), approvedHash: null, approvedAt: null, approvedBy: '', publication: 'draft', campaignSnapshot: campaign };
        state.reviews = [...state.reviews.filter(item => item.postId !== final.id), record];
      }
    });
    return;
  }
  if (action === 'publish') { await publishMarketingPost(pageId, String(input.postId), undefined, revision); return; }
  await changeWorkspace(pageId, revision, async (state, db) => {
    if (action === 'profile') {
      const accountId = marketingText(input.accountId, 'Tài khoản', 100, true);
      if (!accounts.some(item => item.id === accountId)) throw new MarketingWorkflowError('Tài khoản không thuộc shop.');
      state.profiles[accountId] = parseMarketingProfile(input.profile);
      for (const campaign of state.campaigns.filter(item => item.accountId === accountId)) { campaign.version++; campaign.approvedAt = null; campaign.profile = state.profiles[accountId]; }
      invalidatePostSchedules(state, state.reviews.filter(review => review.accountId === accountId).map(review => review.postId));
    } else if (action === 'campaign') {
      const brief = parseCampaignBrief(input.brief, accounts);
      const knowledge = parseAiKnowledge(input.knowledge);
      if (brief.productIds.some(id => !knowledge.products.some(product => product.id === id))) throw new MarketingWorkflowError('Sản phẩm đã chọn không còn trong danh mục.');
      knowledge.products = knowledge.products.filter(product => brief.productIds.includes(product.id));
      knowledge.emailTriggers = [];
      const previous = input.id ? findCampaign(state, input.id) : undefined;
      if (!previous && state.campaigns.length >= 50) throw new MarketingWorkflowError('Tối đa 50 chiến dịch.');
      const campaign: MarketingCampaign = { ...brief, id: previous?.id ?? randomUUID(), version: (previous?.version ?? 0) + 1, approvedAt: null, approvedBy: '', knowledge,
        configuration: parseAiConfiguration(input.configuration), profile: state.profiles[brief.accountId] ?? { ...emptyMarketingProfile(), name: accounts.find(item => item.id === brief.accountId)!.name, tone: '', address: '', cta: '' } };
      state.campaigns = [campaign, ...state.campaigns.filter(item => item.id !== campaign.id)];
      if (previous) invalidatePostSchedules(state, state.reviews.filter(review => review.campaignId === campaign.id).map(review => review.postId));
    } else if (action === 'approveCampaign') {
      const campaign = findCampaign(state, input.id); requireCampaignReady(campaign);
      campaign.approvedAt = Date.now(); campaign.approvedBy = actor;
    } else if (action === 'editPost' || action === 'approvePost') {
      const review = findReview(state, input.postId);
      if (review.publication !== 'draft') throw new MarketingWorkflowError('Bài đang đăng hoặc đã đăng không thể sửa/duyệt lại.');
      if (action === 'editPost') {
        await updateDraft(review.postId, parsePostEdit(input.patch), db); review.approvedAt = null; review.approvedHash = null; review.reviewHash = '';
        invalidatePostSchedules(state, [review.postId]);
      } else {
        requireCurrentCampaign(state, review);
        const post = await getPost(review.postId, db);
        if (review.reviewHash !== marketingPostHash(post)) throw new MarketingWorkflowError('Chạy Review lại sau khi chỉnh bài hoặc ảnh.');
        review.approvedHash = review.reviewHash; review.approvedAt = Date.now(); review.approvedBy = actor;
      }
    } else if (action === 'schedule') {
      if (!Array.isArray(input.slots) || !input.slots.length || input.slots.length > 84) throw new MarketingWorkflowError('Chọn 1–84 mốc đăng.');
      if (state.schedules.length >= 50) throw new MarketingWorkflowError('Tối đa 50 lịch đăng.');
      const slots: MarketingSchedule['slots'] = [];
      for (const raw of input.slots as Record<string, unknown>[]) {
        if (!Number.isSafeInteger(raw.at) || Number(raw.at) <= Date.now()) throw new MarketingWorkflowError('Giờ đăng phải ở tương lai.');
        const post = await getPost(String(raw.postId), db);
        const { hash } = requireApprovedMarketingPost(state, post, Number(raw.at));
        slots.push({ id: randomUUID(), postId: post.id, at: Number(raw.at), approvedHash: hash, status: 'scheduled' as const, message: '' });
      }
      const existing = state.schedules.filter(item => item.status !== 'cancelled').flatMap(item => item.slots);
      if (slots.some((slot, i) => [...existing, ...slots.slice(0, i)].some(other => other.at === slot.at && other.postId === slot.postId))) throw new MarketingWorkflowError('Trùng bài và giờ đăng.');
      state.schedules.unshift({ id: randomUUID(), name: marketingText(input.name, 'Tên lịch', 150, true), scenario: marketingText(input.scenario, 'Kịch bản', 100, true), timezone: 'Asia/Ho_Chi_Minh', status: 'draft', approvedAt: null, approvedBy: '', slots });
    } else if (['approveSchedule', 'activateSchedule', 'pauseSchedule', 'cancelSchedule'].includes(action)) {
      const schedule = state.schedules.find(item => item.id === input.id);
      if (!schedule || schedule.status === 'cancelled') throw new MarketingWorkflowError('Không tìm thấy lịch hoạt động.');
      if (action === 'pauseSchedule') { schedule.status = 'paused'; return; }
      if (action === 'cancelSchedule') { schedule.status = 'cancelled'; return; }
      for (const slot of schedule.slots.filter(item => item.status === 'scheduled')) {
        const { hash } = requireApprovedMarketingPost(state, await getPost(slot.postId, db), slot.at);
        if (slot.at <= Date.now() || hash !== slot.approvedHash) throw new MarketingWorkflowError('Bài hoặc giờ đăng đã thay đổi. Lập lịch mới để duyệt lại.');
      }
      if (action === 'approveSchedule') { schedule.approvedAt = Date.now(); schedule.approvedBy = actor; schedule.status = 'approved'; }
      else { if (!schedule.approvedAt) throw new MarketingWorkflowError('Duyệt lịch trước khi kích hoạt.'); schedule.status = 'active'; }
    } else throw new MarketingWorkflowError('Hành động không hợp lệ.');
  });
}

export async function managedMarketingPost(pageId: string, postId: string) {
  try { return (await readMarketingWorkspace(pageId)).workspace.reviews.some(item => item.postId === postId); }
  catch (error) { if ((error as { code?: string }).code === '42P01') return false; throw error; }
}
export async function publishMarketingPost(pageId: string, postId: string, slotId?: string, revision?: number) {
  const claim = await changeWorkspace(pageId, revision, async (state, db) => {
    await assertOperationAllowed();
    const post = await getPost(postId, db);
    const { review, campaign } = requireApprovedMarketingPost(state, post);
    let schedule: MarketingSchedule | undefined;
    const slot = slotId ? state.schedules.flatMap(item => { if (item.slots.some(slot => slot.id === slotId)) schedule = item; return item.slots; }).find(item => item.id === slotId) : undefined;
    if (slotId && (!slot || slot.postId !== postId || slot.status !== 'scheduled' || schedule?.status !== 'active' || !schedule.approvedAt || slot.at > Date.now() || slot.approvedHash !== review.approvedHash)) throw new MarketingWorkflowError('Lịch chưa được duyệt/kích hoạt hoặc không đến hạn.');
    if (review.publication === 'publishing' || review.publication === 'unknown' || (!slot && review.publication === 'published')) throw new MarketingWorkflowError('Bài đã gửi hoặc đang chờ xác minh, không gửi lại.', 409);
    review.publication = 'publishing'; if (slot) slot.status = 'publishing';
    return { post, mock: campaign.accountId !== pageId };
  });
  let attempted = false;
  try {
    // A committed claim survives ambiguous provider outcomes; never automatically retry it.
    const fresh = (await readMarketingWorkspace(pageId)).workspace;
    if (slotId && !fresh.schedules.some(schedule => schedule.status === 'active' && schedule.slots.some(slot => slot.id === slotId))) throw new MarketingWorkflowError('Lịch đã tạm dừng trước khi gửi.');
    requireApprovedMarketingPost(fresh, await getPost(postId));
    const image = claim.post.image ? await getPostImage(postId) : undefined;
    attempted = true;
    const external = claim.mock ? { id: `sample-${randomUUID()}`, url: null } : await publishToFacebookPage(composePostMessage(claim.post), image ?? undefined);
    await changeWorkspace(pageId, undefined, async (state, db) => {
      const review = findReview(state, postId); review.publication = 'published'; review.externalId = external.id; review.externalUrl = external.url ?? undefined;
      review.publications = [...(review.publications ?? []), { externalId: external.id, externalUrl: external.url, at: Date.now() }];
      if (slotId) { const slot = state.schedules.flatMap(schedule => schedule.slots).find(item => item.id === slotId)!; slot.status = 'published'; slot.message = claim.mock ? 'Hoàn tất trên kênh mẫu' : 'Đã đăng Facebook'; }
      if (claim.post.status === 'draft' && !claim.mock) await markPublished(postId, external, db);
    });
    return await getPost(postId);
  } catch (error) {
    await changeWorkspace(pageId, undefined, async state => {
      findReview(state, postId).publication = attempted ? 'unknown' : 'draft';
      if (slotId) { const slot = state.schedules.flatMap(schedule => schedule.slots).find(item => item.id === slotId)!; slot.status = attempted ? 'unknown' : 'blocked'; slot.message = attempted ? 'Chưa xác nhận kết quả. Kiểm tra trên tài khoản trước khi xử lý tiếp.' : 'Chưa gửi: dữ liệu hoặc quyền đã thay đổi. Lập lịch và duyệt lại.'; }
    });
    throw error;
  }
}

export async function runMarketingSchedules(pageId: string) {
  const state = (await readMarketingWorkspace(pageId)).workspace;
  const due = state.schedules.filter(schedule => schedule.status === 'active').flatMap(schedule => schedule.slots.map(slot => ({ slot, approvedAt: schedule.approvedAt! }))).filter(({ slot }) => slot.status === 'scheduled' && slot.at <= Date.now()).slice(0, 3);
  for (const { slot, approvedAt } of due) {
    if (Date.now() - slot.at > 15 * 60000) {
      await changeWorkspace(pageId, undefined, async workspace => { const target = workspace.schedules.flatMap(schedule => schedule.slots).find(item => item.id === slot.id)!; if (target.status === 'scheduled') { target.status = 'missed'; target.message = 'Mốc đã lỡ; lập giờ mới và duyệt lại.'; } });
      continue;
    }
    try { await runAutomaticAccess(approvedAt, () => publishMarketingPost(pageId, slot.postId, slot.id)); }
    catch (error) {
      if (error instanceof MarketingWorkflowError) await changeWorkspace(pageId, undefined, async workspace => {
        const target = workspace.schedules.flatMap(schedule => schedule.slots).find(item => item.id === slot.id);
        if (target?.status === 'scheduled') { target.status = 'blocked'; target.message = error.message; }
      });
    }
  }
  return { checked: due.length };
}

export async function changeMarketingImage(pageId: string, revision: number, postId: string, image: StoredPostImage | null) {
  await changeWorkspace(pageId, revision, async (state, db) => {
    const review = findReview(state, postId);
    if (review.publication !== 'draft') throw new MarketingWorkflowError('Không thay ảnh của bài đang gửi hoặc đã đăng.');
    if (image) await setPostImage(postId, image, db); else await deletePostImage(postId, db);
    review.approvedAt = null; review.approvedHash = null; review.reviewHash = '';
    invalidatePostSchedules(state, [postId]);
  });
}
