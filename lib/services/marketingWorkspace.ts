import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { createPost, getPost, getPostImage, listPosts, markPublished, updateDraft, setPostImage, deletePostImage, type StoredPostImage } from '@/lib/services/postsPostgres';
import { publishToFacebookPage } from '@/lib/services/facebookPage';
import { composePostMessage, parsePostEdit } from '@/lib/services/aiPost';
import { assertOperationAllowed, runAutomaticAccess } from '@/lib/services/appSecurity';
import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { readPageProfile } from '@/lib/services/aiGlobalSettings';
import { generateReviewedMarketing } from '@/lib/services/aiPostReview';
import { marketingReviewCatalog, requireFreshReviewEvidence } from '@/lib/services/marketingReviewSources';
import { blockingIssue } from '@/lib/services/reviewEvidence';
import { generateContentPlan, parseContentPlan, planReviewSource, requireContentPlan, reviewContentPlan } from '@/lib/services/marketingContentPlan';
import { emptyCampaignBrief, emptyMarketingProfile, emptyMarketingWorkspace, marketingText, MarketingWorkflowError, MARKETING_POST_GOALS, offerValidAt, parseCampaignBrief, parseMarketingProfile, requireCampaignReady } from '@/lib/services/marketingBrief';
import { readSourcingSelection } from '@/lib/services/sourcingWorkflow';
import type { MarketingAccount, MarketingCampaign, MarketingPlanBinding, MarketingSchedule, MarketingWorkspace, MarketingWorkspaceView, ReviewedMarketingPost } from '@/lib/types/marketingWorkspace';
import type { GeneratedPostDraft, MarketingPost } from '@/lib/types/posts';
import type { ReviewAttempt } from '@/lib/types/postReview';

export function marketingAccounts(pageId: string): MarketingAccount[] {
  return [{ id: pageId, name: 'Fanpage Facebook', platform: 'facebook', mock: false },
    { id: 'sample-instagram', name: 'Instagram · Kênh mẫu', platform: 'instagram', mock: true },
    { id: 'sample-tiktok', name: 'TikTok · Kênh mẫu', platform: 'tiktok', mock: true },
    { id: 'sample-shopee', name: 'Shopee · Kênh mẫu', platform: 'shopee', mock: true }];
}
const document = (value: unknown): MarketingWorkspace => typeof value === 'string' ? JSON.parse(value) : value as MarketingWorkspace;
export async function readMarketingWorkspace(pageId: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
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
  requireContentPlan(state, campaign, review.plan);
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

async function requireReviewSources(pageId: string, state: MarketingWorkspace, review: ReviewedMarketingPost, db: Pick<Pool, 'query'> = getMessengerPool()) {
  const campaign = requireCurrentCampaign(state, review), account = marketingAccounts(pageId).find(item => item.id === campaign.accountId);
  if (!account) throw new MarketingWorkflowError('Tài khoản Review không thuộc shop.', 403);
  requireFreshReviewEvidence(review.review?.evidence, await postReviewCatalog(pageId, state, campaign, account, review.plan!, db));
}

async function postReviewCatalog(pageId: string, state: MarketingWorkspace, campaign: MarketingCampaign, account: MarketingAccount, binding: MarketingPlanBinding, db: Pick<Pool, 'query'> = getMessengerPool()) {
  const { plan, item } = requireContentPlan(state, campaign, binding);
  const catalog = await marketingReviewCatalog(pageId, campaign, account, db);
  return [...catalog, planReviewSource(plan, catalog[0].scope, item.id)];
}

function invalidatePlanPosts(state: MarketingWorkspace, planIds: string[]) {
  const posts = state.reviews.filter(review => review.plan && planIds.includes(review.plan.id));
  for (const post of posts) { post.approvedAt = null; post.approvedHash = null; post.approvedBy = ''; }
  invalidatePostSchedules(state, posts.map(post => post.postId));
}

export async function marketingWorkspaceAction(pageId: string, actor: string, revision: number, action: string, input: Record<string, unknown>, sourcingOwner?: string, signal?: AbortSignal) {
  const accounts = marketingAccounts(pageId);
  if (action === 'generatePlan' || action === 'reviewPlan') {
    const current = await readMarketingWorkspace(pageId);
    if (current.revision !== revision) throw new MarketingWorkflowError('Tải lại dữ liệu trước khi lập kế hoạch.', 409);
    if (action === 'generatePlan' && (current.workspace.contentPlans?.length ?? 0) >= 100) throw new MarketingWorkflowError('Tối đa 100 phương án kế hoạch.');
    const existing = action === 'reviewPlan' ? current.workspace.contentPlans?.find(p => p.id === input.id) : undefined;
    if (action === 'reviewPlan' && (!existing || existing.approvedAt)) throw new MarketingWorkflowError('Lưu bản chỉnh sửa trước khi Review lại kế hoạch.');
    const campaign = findCampaign(current.workspace, existing?.campaignId ?? input.campaignId);
    if (!campaign.approvedAt) throw new MarketingWorkflowError('Duyệt brief trước khi lập kế hoạch.');
    requireCampaignReady(campaign);
    if (existing && existing.campaignVersion !== campaign.version) throw new MarketingWorkflowError('Brief đã thay đổi. Tạo kế hoạch theo brief mới.', 409);
    const account = accounts.find(a => a.id === campaign.accountId);
    if (!account) throw new MarketingWorkflowError('Tài khoản không thuộc shop.', 403);
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000);
    const plan = existing ?? await generateContentPlan(campaign, account, deadline);
    plan.review = await reviewContentPlan(plan, campaign, account, await marketingReviewCatalog(pageId, campaign, account), deadline);
    await changeWorkspace(pageId, revision, async (state, db) => {
      const catalog = await marketingReviewCatalog(pageId, campaign, account, db);
      try { requireFreshReviewEvidence(plan.review!.evidence, [...catalog, planReviewSource(plan, catalog[0].scope)]); }
      catch (error) {
        if (!(error instanceof MarketingWorkflowError)) throw error;
        plan.review!.status = 'blocked';
        plan.review!.variants = plan.review!.variants.map(v => ({ ...v, status: 'needs_input', finalDraft: null, issues: [...v.issues, blockingIssue('conflict', error.message)] }));
      }
      if (!existing && (state.contentPlans?.length ?? 0) >= 100) throw new MarketingWorkflowError('Tối đa 100 phương án kế hoạch.');
      state.contentPlans = [plan, ...(state.contentPlans ?? []).filter(p => p.id !== plan.id)];
    });
    return;
  }
  // AI runs outside the transaction; the revision check prevents overwriting newer edits.
  if (action === 'generate' || action === 'review' || action === 'retryReview') {
    const current = await readMarketingWorkspace(pageId);
    if (current.revision !== revision) throw new MarketingWorkflowError('Tải lại dữ liệu trước khi tạo bài.', 409);
    const retry = action === 'retryReview' ? current.workspace.reviewAttempts?.find(item => item.id === input.attemptId && !item.appliedAt && !item.discardedAt && item.variants.some(variant => !variant.finalDraft)) : undefined;
    if (action === 'retryReview' && !retry) throw new MarketingWorkflowError('Lượt Review không còn khả dụng.', 404);
    const targetId = retry?.targetPostId ?? (action === 'review' ? input.postId : undefined);
    const previous = targetId ? findReview(current.workspace, targetId) : undefined;
    const campaign = findCampaign(current.workspace, previous?.campaignId ?? retry?.campaignId ?? input.campaignId);
    if (!campaign.approvedAt) throw new MarketingWorkflowError('Duyệt brief trước khi soạn hoặc kiểm tra nội dung.');
    requireCampaignReady(campaign);
    const account = accounts.find(item => item.id === campaign.accountId);
    if (!account) throw new MarketingWorkflowError('Tài khoản không thuộc shop.', 403);
    const selected = (action === 'retryReview' ? retry?.plan : input.plan ?? previous?.plan) as MarketingPlanBinding | undefined;
    const { plan: approvedPlan, item: outline } = requireContentPlan(current.workspace, campaign, selected);
    const binding = { id: approvedPlan.id, version: approvedPlan.version, itemId: outline.id };
    if (retry && retry.campaignVersion !== campaign.version) throw new MarketingWorkflowError('Brief đã thay đổi. Tạo lượt Review theo brief mới.', 409);
    const post = previous ? await getPost(previous.postId) : undefined;
    if (previous?.publication !== undefined && previous.publication !== 'draft') throw new MarketingWorkflowError('Không sửa bài đã đăng hoặc đang được gửi.');
    if (retry?.basePostHash && post && retry.basePostHash !== marketingPostHash(post)) throw new MarketingWorkflowError('Bài/ảnh đã đổi. Review lại bản đang sửa.', 409);
    const original: GeneratedPostDraft | undefined = retry?.variants[0]?.original ?? (post ? { title: post.title, content: post.content, hashtags: post.hashtags, imageIdea: post.imageIdea, imagePrompt: '' } : undefined);
    const results = await generateReviewedMarketing(campaign, account, await postReviewCatalog(pageId, current.workspace, campaign, account, binding!), original, signal, outline);
    await changeWorkspace(pageId, revision, async (state, db) => {
      if (!previous && state.reviews.length >= 100) throw new MarketingWorkflowError('Tối đa 100 bài theo chiến dịch.');
      try { requireFreshReviewEvidence(results.evidence, await postReviewCatalog(pageId, state, campaign, account, binding!, db)); }
      catch (error) {
        if (!(error instanceof MarketingWorkflowError)) throw error;
        results.status = 'blocked'; results.variants = results.variants.map(item => ({ ...item, finalDraft: null, status: 'needs_input', issues: [...item.issues, blockingIssue('conflict', error.message)] }));
      }
      const attempt: ReviewAttempt = { ...results, plan: binding, id: retry?.id ?? randomUUID(), campaignId: campaign.id, campaignVersion: campaign.version, accountId: account.id, createdAt: Date.now(),
        ...(post ? { targetPostId: post.id, basePostHash: marketingPostHash(post) } : {}) };
      state.reviewAttempts = [attempt, ...(state.reviewAttempts ?? []).filter(item => item.id !== attempt.id)].slice(0, 20);
      // Re-review proposes a candidate; the current post and its approval stay intact until Apply.
      if (previous) return;
      for (const result of results.variants.filter(item => item.finalDraft)) {
        const final = await createPost({ ...result.finalDraft!, channel: account.mock ? 'tiktok' : 'facebook', goal: MARKETING_POST_GOALS[campaign.goal], productSkus: campaign.knowledge.products.filter(item => campaign.productIds.includes(item.id)).map(item => item.sku) }, db);
        const record: ReviewedMarketingPost = { plan: binding, outlineSnapshot: { title: outline.title, outline: outline.outline, pillar: approvedPlan.pillars[outline.pillarIndex].name }, postId: final.id, campaignId: campaign.id, campaignVersion: campaign.version, accountId: account.id, original: result.original, changes: result.changes.map(change => change.reason), review: { ...results, variants: [result] },
          reviewHash: marketingPostHash(final), reviewedAt: Date.now(), approvedHash: null, approvedAt: null, approvedBy: '', publication: 'draft', campaignSnapshot: campaign };
        state.reviews = [record, ...state.reviews];
      }
    });
    return;
  }
  if (action === 'publish') { await publishMarketingPost(pageId, String(input.postId), undefined, revision); return; }
  await changeWorkspace(pageId, revision, async (state, db) => {
    if (action === 'editPlan' || action === 'approvePlan') {
      const plan = state.contentPlans?.find(p => p.id === input.id);
      if (!plan) throw new MarketingWorkflowError('Không tìm thấy kế hoạch.', 404);
      const campaign = findCampaign(state, plan.campaignId);
      if (!campaign.approvedAt || campaign.version !== plan.campaignVersion) throw new MarketingWorkflowError('Brief đã thay đổi. Tạo kế hoạch theo brief mới.', 409);
      if (action === 'editPlan') {
        const parsed = parseContentPlan(input.plan);
        Object.assign(plan, parsed, { version: plan.version + 1, contentModel: 'edited', approvedAt: null, approvedBy: '', review: undefined });
        invalidatePlanPosts(state, [plan.id]);
      } else {
        if (plan.approvedAt) return;
        if (!plan.review || plan.review.status !== 'completed' || plan.review.variants.length !== plan.items.length || plan.review.variants.some(v => !v.finalDraft)) throw new MarketingWorkflowError('Review đầy đủ dàn ý trước khi duyệt kế hoạch.');
        const account = accounts.find(a => a.id === campaign.accountId)!;
        const catalog = await marketingReviewCatalog(pageId, campaign, account, db);
        requireFreshReviewEvidence(plan.review.evidence, [...catalog, planReviewSource(plan, catalog[0].scope)]);
        for (const other of (state.contentPlans ?? []).filter(p => p.campaignId === campaign.id && p.id !== plan.id && p.approvedAt)) { other.approvedAt = null; invalidatePlanPosts(state, [other.id]); }
        plan.items = parseContentPlan({ pillars: plan.pillars, items: plan.items.map((item, i) => ({ ...item, title: plan.review!.variants[i].finalDraft!.title, outline: plan.review!.variants[i].finalDraft!.content })) }).items;
        plan.approvedAt = Date.now(); plan.approvedBy = actor;
      }
    } else if (action === 'applyReview' || action === 'discardReview') {
      const attempt = state.reviewAttempts?.find(item => item.id === input.attemptId && !item.appliedAt && !item.discardedAt);
      if (!attempt) throw new MarketingWorkflowError('Lượt Review không còn khả dụng.', 404);
      if (action === 'discardReview') { attempt.discardedAt = Date.now(); return; }
      const result = attempt.variants.find(item => item.draftId === input.draftId && item.finalDraft);
      if (!attempt.targetPostId || !result?.finalDraft) throw new MarketingWorkflowError('Chưa có bản đề xuất hợp lệ để áp dụng.');
      const review = findReview(state, attempt.targetPostId), campaign = findCampaign(state, attempt.campaignId), post = await getPost(review.postId, db);
      if (review.publication !== 'draft' || marketingPostHash(post) !== attempt.basePostHash || !campaign.approvedAt || campaign.version !== attempt.campaignVersion) throw new MarketingWorkflowError('Bài/ảnh/brief đã thay đổi. Review lại trước khi áp dụng.', 409);
      const account = accounts.find(item => item.id === campaign.accountId)!;
      requireFreshReviewEvidence(attempt.evidence, await postReviewCatalog(pageId, state, campaign, account, attempt.plan!, db));
      const final = await updateDraft(post.id, result.finalDraft, db);
      const { plan: currentPlan, item: currentOutline } = requireContentPlan(state, campaign, attempt.plan);
      Object.assign(review, { original: result.original, changes: result.changes.map(change => change.reason), review: { ...attempt, variants: [result] }, reviewHash: marketingPostHash(final), reviewedAt: Date.now(), campaignVersion: campaign.version,
        plan: attempt.plan, outlineSnapshot: { title: currentOutline.title, outline: currentOutline.outline, pillar: currentPlan.pillars[currentOutline.pillarIndex].name }, approvedAt: null, approvedHash: null, approvedBy: '', campaignSnapshot: campaign });
      attempt.appliedAt = Date.now(); invalidatePostSchedules(state, [post.id]);
    } else if (action === 'sourcingIdea') {
      if (!sourcingOwner || input.confirmed !== true) throw new MarketingWorkflowError('Xác nhận mapping trước khi tạo brief nháp.');
      if (state.campaigns.some(campaign => campaign.sourcing?.runId === input.runId && campaign.sourcing?.itemKey === input.itemKey)) return;
      if (state.campaigns.length >= 50) throw new MarketingWorkflowError('Tối đa 50 chiến dịch.');
      const item = await readSourcingSelection(sourcingOwner, input.runId, input.itemKey);
      const campaign: MarketingCampaign = { ...emptyCampaignBrief(pageId), id: randomUUID(), version: 1,
        name: `Ý tưởng: ${item.title}`.slice(0, 150), message: item.title.slice(0, 500),
        notes: `Nguồn khảo sát: ${item.url}\nChưa xác nhận sản phẩm đang bán, giá bán, tồn kho hoặc chất lượng nguồn hàng.`.slice(0, 1500),
        approvedAt: null, approvedBy: '', knowledge: parseAiKnowledge(input.knowledge), configuration: (await readPageProfile(pageId, db)).configuration,
        profile: state.profiles[pageId] ?? emptyMarketingProfile(), sourcing: { runId: String(input.runId), itemKey: String(input.itemKey) } };
      state.campaigns.unshift(campaign);
    } else if (action === 'profile') {
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
      const campaign: MarketingCampaign = { ...brief, ...(previous?.sourcing ? { sourcing: previous.sourcing } : {}), id: previous?.id ?? randomUUID(), version: (previous?.version ?? 0) + 1, approvedAt: null, approvedBy: '', knowledge,
        configuration: (await readPageProfile(pageId, db)).configuration, profile: state.profiles[brief.accountId] ?? { ...emptyMarketingProfile(), name: accounts.find(item => item.id === brief.accountId)!.name, tone: '', address: '', cta: '' } };
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
        await requireReviewSources(pageId, state, review, db);
        review.approvedHash = review.reviewHash; review.approvedAt = Date.now(); review.approvedBy = actor;
      }
    } else if (action === 'schedule') {
      if (!Array.isArray(input.slots) || !input.slots.length || input.slots.length > 84) throw new MarketingWorkflowError('Chọn 1–84 mốc đăng.');
      if (state.schedules.length >= 50) throw new MarketingWorkflowError('Tối đa 50 lịch đăng.');
      const slots: MarketingSchedule['slots'] = [];
      for (const raw of input.slots as Record<string, unknown>[]) {
        if (!Number.isSafeInteger(raw.at) || Number(raw.at) <= Date.now()) throw new MarketingWorkflowError('Giờ đăng phải ở tương lai.');
        const post = await getPost(String(raw.postId), db);
        const { hash, review } = requireApprovedMarketingPost(state, post, Number(raw.at));
        await requireReviewSources(pageId, state, review, db);
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
        const { hash, review } = requireApprovedMarketingPost(state, await getPost(slot.postId, db), slot.at);
        await requireReviewSources(pageId, state, review, db);
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
    await requireReviewSources(pageId, state, review, db);
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
    const freshReview = requireApprovedMarketingPost(fresh, await getPost(postId)).review;
    await requireReviewSources(pageId, fresh, freshReview);
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
