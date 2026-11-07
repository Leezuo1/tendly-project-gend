import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, afterEach } from 'node:test';
import { newDb } from 'pg-mem';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const previous = process.env.DATABASE_URL;
afterEach(() => { if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; });
async function fixture() {
  process.env.DATABASE_URL = 'postgres://test';
  const mem = newDb();
  mem.public.none(readFileSync('db/migrations/002-marketing-posts.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/006-marketing-post-images.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/015-marketing-workspace.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/014-sourcing.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/019-sourcing-workflow.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/020-ai-global-settings.sql', 'utf8'));
  mem.public.none(readFileSync('db/migrations/021-ai-page-settings.sql', 'utf8'));
  mem.public.none('CREATE TABLE messenger_ai_settings(page_id TEXT PRIMARY KEY,knowledge_json JSONB,approved_at BIGINT,updated_at BIGINT)');
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  let publishes = 0;
  let failPublication = false, failReview = false;
  let reviewHook;
  let reviewContent = 'Giá 221.000đ, nhắn tin để tư vấn.';
  let outlineReview;
  const calls = [];
  const cache = new Map();
  const load = file => {
    if (file === 'lib/services/appSecurity.ts') return { assertOperationAllowed: async () => {}, runAutomaticAccess: (_at, fn) => fn() };
    if (file === 'lib/services/messengerPostgres.ts') return { getMessengerPool: () => pool };
    if (file === 'lib/services/facebookPage.ts') return { publishToFacebookPage: async () => { publishes++; if (failPublication) throw new Error('Connection lost after send'); return { id: '123_456', url: 'https://www.facebook.com/123_456' }; } };
    if (file === 'lib/services/gemini.ts') return { generateGeminiJson: async options => {
      calls.push(options);
      if (options.schema.properties.pillars) return { result: options.parse(JSON.stringify({ pillars: [{ name: 'Product value', objective: 'Explain benefits' }], items: [{ pillarIndex: 0, title: 'Product guide', outline: 'Opening: customer need.\nDetails: product facts.\nCTA: inbox.' }] })), model: 'test-plan' };
      const review = options.system.startsWith('Bạn là AI Review');
      if (review && reviewHook) { const hook = reviewHook; reviewHook = undefined; await hook(); }
      if (review && failReview) throw new Error('Review timeout');
      const draft = { title: 'Áo thun', content: 'Giá 259.000đ.', hashtags: [], imageIdea: 'Ảnh áo', imagePrompt: '' };
      const input = review ? JSON.parse(options.user) : null;
      const variants = review ? input.variants.map(({ draftId, draft: original }) => {
        const content = input.channel === 'outline' ? outlineReview ?? original.content : reviewContent, finalDraft = { ...original, content };
        return { draftId, status: original.content === content ? 'unchanged' : 'corrected', finalDraft, changes: original.content === content ? [] : [{ field: 'content', before: original.content, after: content, reason: 'Sửa giá theo nguồn', sourceIds: [input.evidence.sources.find(s => s.kind === 'product').id] }], issues: [] };
      }) : [draft];
      return { result: options.parse(JSON.stringify({ variants })), model: 'test-model' };
    } };
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} }; cache.set(file, loadedModule);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name === 'pg' ? pg : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  const service = load('lib/services/marketingWorkspace.ts');
  const briefApi = load('lib/services/marketingBrief.ts');
  const config = load('lib/services/aiConfiguration.ts').defaultAiConfiguration();
  const seed = load('lib/data/admin.ts').createSeed();
  const knowledge = { shop: seed.shop, productSource: seed.productSource, products: seed.products, faqs: [], emailTriggers: [] };
  let revision = 0;
  const act = async (action, input) => { await service.marketingWorkspaceAction('123', 'owner', revision, action, input); revision = (await service.readMarketingWorkspace('123')).revision; };
  const brief = { ...briefApi.emptyCampaignBrief('sample-instagram'), name: 'Campaign kiểm tra', audience: 'Dân văn phòng', pain: 'Cần áo thoải mái', message: 'Mặc mát', cta: 'Inbox shop', productIds: [seed.products[0].id] };
  const state = () => service.readMarketingWorkspace('123');
  const plan = async campaignId => {
    await act('generatePlan', { campaignId });
    const created = (await state()).workspace.contentPlans[0];
    await act('approvePlan', { id: created.id });
    calls.length = 0;
    return { id: created.id, version: created.version, itemId: created.items[0].id };
  };
  return { load, service, briefApi, config, knowledge, brief, act, state, plan, pool, publishes: () => publishes, calls,
    onReview: hook => { reviewHook = hook; }, failPublication: () => { failPublication = true; }, failReview: () => { failReview = true; }, restoreReview: () => { failReview = false; }, setReviewContent: content => { reviewContent = content; }, setOutlineReview: content => { outlineReview = content; } };
}

test('brief validation and finite weekly preview handle missing data, date limits and offer validity', async () => {
  const { briefApi: api, brief, service } = await fixture();
  assert.equal(api.parseCampaignBrief(brief, service.marketingAccounts('123')).name, brief.name);
  assert.throws(() => api.parseCampaignBrief({ ...brief, accountId: 'other-shop' }, service.marketingAccounts('123')));
  assert.throws(() => api.requireCampaignReady({ ...brief, pain: '' }));
  assert.throws(() => api.requireCampaignReady({ ...brief, offer: { ...brief.offer, kind: 'discount' } }));
  const dates = api.weeklyMarketingDates('2027-01-04', [1, 3, 5], '09:00', 2);
  assert.equal(dates.length, 6);
  assert.equal(new Date(dates[0]).toISOString(), '2027-01-04T02:00:00.000Z');
  assert.throws(() => api.weeklyMarketingDates('2027-02-30', [1], '09:00', 2));
  assert.throws(() => api.weeklyMarketingDates('2027-01-01', [1], '25:00', 2));
  assert.throws(() => api.weeklyMarketingDates('2027-01-01', [1], '09:00', 100));
});

test('owned sourcing result transfers only to an unapproved idea brief and repeated mapping is idempotent', async () => {
  const f = await fixture(), runId = 'd3c4f90b-31aa-431c-8db0-fc9152cb0d32';
  const candidate = { title: 'Áo từ nguồn mới', url: 'https://example.com/polo', description: 'Nguồn khảo sát', source: 'google', collectedAt: new Date().toISOString(), price: null, currency: null, unit: null, moq: null, region: null };
  await f.pool.query(`INSERT INTO sourcing_runs(id,owner,kind,status,context_json,result_json,created_at,updated_at) VALUES($1,'source-owner','suppliers','succeeded','{}',$2::jsonb,1,1)`, [runId, JSON.stringify({ candidates: [candidate] })]);
  const input = { runId, itemKey: JSON.stringify(['google', candidate.url]), confirmed: true, knowledge: f.knowledge, configuration: f.config };
  await assert.rejects(f.service.marketingWorkspaceAction('123', 'owner', 0, 'sourcingIdea', input, 'other-owner'));
  await assert.rejects(f.service.marketingWorkspaceAction('123', 'owner', 0, 'sourcingIdea', { ...input, confirmed: false }, 'source-owner'));
  await f.service.marketingWorkspaceAction('123', 'owner', 0, 'sourcingIdea', input, 'source-owner');
  let state = await f.state(), campaign = state.workspace.campaigns[0];
  assert.equal(campaign.approvedAt, null); assert.deepEqual(campaign.productIds, []); assert.equal(campaign.offer.kind, 'none');
  assert.ok(campaign.notes.includes(candidate.url)); assert.deepEqual(state.workspace.reviews, []); assert.deepEqual(state.workspace.schedules, []); assert.equal(f.publishes(), 0);
  await f.service.marketingWorkspaceAction('123', 'owner', state.revision, 'sourcingIdea', input, 'source-owner');
  state = await f.state(); assert.equal(state.workspace.campaigns.length, 1);
  await assert.rejects(f.service.marketingWorkspaceAction('123', 'owner', state.revision, 'approveCampaign', { id: campaign.id }), /Bổ sung đối tượng/);
});

test('campaign → Review → owner approval → mock publication never calls Facebook', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await assert.rejects(() => f.act('generate', { campaignId: campaign.id }), /Duyệt brief/);
  await f.act('approveCampaign', { id: campaign.id });
  await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  let meta = (await f.state()).workspace.reviews[0];
  await assert.rejects(() => f.act('publish', { postId: meta.postId }), /chủ shop duyệt/);
  await f.act('approvePost', { postId: meta.postId });
  await f.act('publish', { postId: meta.postId });
  meta = (await f.state()).workspace.reviews[0];
  assert.equal(meta.publication, 'published');
  assert.equal(f.publishes(), 0);
  await assert.rejects(() => f.act('publish', { postId: meta.postId }), /không gửi lại/);
});

test('changing global AI rules invalidates a previously approved post before publication', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id });
  await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.pool.query('UPDATE ai_global_settings SET revision=revision+1 WHERE id=1');
  await assert.rejects(f.act('publish', { postId }), /Review/);
  assert.equal(f.publishes(), 0);
});

test('editing or changing Page profile invalidates approval and stale writes are rejected', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.act('editPost', { postId, patch: { content: 'Bản đã sửa' } });
  await assert.rejects(() => f.act('approvePost', { postId }), /Review lại/);
  await f.act('review', { postId });
  const proposal = (await f.state()).workspace.reviewAttempts.find(item => item.targetPostId === postId);
  await f.act('applyReview', { attemptId: proposal.id, draftId: 'draft-0' }); await f.act('approvePost', { postId });
  const old = (await f.state()).revision;
  await f.act('profile', { accountId: 'sample-instagram', profile: { ...f.briefApi.emptyMarketingProfile(), name: 'Kênh khác' } });
  await assert.rejects(() => f.service.marketingWorkspaceAction('123', 'owner', old, 'approvePost', { postId }), /Tải lại/);
  await assert.rejects(() => f.act('publish', { postId }), /Brief đã thay đổi/);
});

test('schedule requires separate approval and activation and blocks changed content', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.act('schedule', { name: 'Lịch tuần', scenario: 'Hằng tuần', slots: [{ postId, at: Date.now() + 3600000 }] });
  const id = (await f.state()).workspace.schedules[0].id;
  await assert.rejects(() => f.act('activateSchedule', { id }), /Duyệt lịch/);
  await f.act('approveSchedule', { id }); await f.act('activateSchedule', { id });
  await f.act('editPost', { postId, patch: { content: 'Đổi sau khi xếp lịch' } });
  await assert.rejects(() => f.act('activateSchedule', { id }), /chủ shop duyệt/);
  await f.act('pauseSchedule', { id });
  assert.equal((await f.state()).workspace.schedules[0].status, 'paused');
});

test('review parser validates stable IDs, blocked status, and malformed output', async () => {
  const f = await fixture(); const api = f.load('lib/services/aiPostReview.ts');
  const draft = { title: 'Áo', content: 'Áo cotton', hashtags: [], imageIdea: '', imagePrompt: '' };
  const item = { draftId: 'draft-0', status: 'unchanged', finalDraft: draft, changes: [], issues: [] };
  const evidence = { sources: [], checkedAt: Date.now() };
  assert.equal(api.parseMarketingReview(JSON.stringify({ variants: [item] }), [draft], evidence, 'facebook')[0].finalDraft.content, draft.content);
  assert.throws(() => api.parseMarketingReview(JSON.stringify({ variants: [{ ...item, draftId: 'draft-1' }] }), [draft], evidence, 'facebook'));
  assert.throws(() => api.parseMarketingReview(JSON.stringify({ variants: [item, item] }), [draft, draft], evidence, 'facebook'));
  assert.throws(() => api.parseMarketingReview('not json', [draft], evidence, 'facebook'));
});

test('Facebook selects Review evidence separately from Content and publishes only after owner approval', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  assert.equal(f.calls.length, 2);
  const contentSource = JSON.parse(f.calls[0].user.split('DỮ LIỆU CONTENT:\n')[1]);
  const reviewInput = JSON.parse(f.calls[1].user);
  assert.ok(contentSource.knowledge.products.length); assert.equal(reviewInput.context, undefined);
  assert.ok(reviewInput.evidence.sources.some(s => s.kind === 'product')); assert.equal(reviewInput.evidence.sources.some(s => s.kind === 'faq'), false);
  const meta = (await f.state()).workspace.reviews[0];
  assert.equal((await f.service.marketingWorkspaceView('123')).posts[0].content, 'Giá 221.000đ, nhắn tin để tư vấn.');
  await f.act('approvePost', { postId: meta.postId }); await f.act('publish', { postId: meta.postId });
  assert.equal(f.publishes(), 1);
  const context = await f.load('lib/services/marketingCommentContext.ts').marketingCommentContext('123', '123_456', f.pool);
  assert.equal(context.context.campaign, campaign.name);
  assert.equal(context.knowledge.products.length, 1);
  assert.equal(context.context.sourceIsCurrent, true);
});

test('Review failure does not return/save an unreviewed draft, ambiguous Facebook outcome is not retried', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); const binding = await f.plan(campaign.id); f.failReview();
  await f.act('generate', { campaignId: campaign.id, plan: binding });
  assert.equal((await f.state()).workspace.reviews.length, 0);
  assert.equal((await f.service.marketingWorkspaceView('123')).posts.length, 0);
  const failed = (await f.state()).workspace.reviewAttempts[0];
  assert.equal(failed.status, 'failed'); assert.ok(failed.variants[0].original.content); assert.equal(failed.variants[0].finalDraft, null);
  f.restoreReview(); const beforeRetry = f.calls.length;
  await f.act('retryReview', { attemptId: failed.id }); assert.equal(f.calls.length, beforeRetry + 1);
  assert.equal((await f.state()).workspace.reviews.length, 1);
  const g = await fixture();
  await g.act('campaign', { brief: { ...g.brief, accountId: '123' }, knowledge: g.knowledge, configuration: g.config });
  const id = (await g.state()).workspace.campaigns[0].id;
  await g.act('approveCampaign', { id }); await g.act('generate', { campaignId: id, plan: await g.plan(id) });
  const postId = (await g.state()).workspace.reviews[0].postId;
  await g.act('approvePost', { postId }); g.failPublication();
  await assert.rejects(() => g.act('publish', { postId }), /Connection lost/);
  assert.equal((await g.state()).workspace.reviews[0].publication, 'unknown');
  await assert.rejects(() => g.service.publishMarketingPost('123', postId), /không gửi lại/);
  assert.equal(g.publishes(), 1);
});

test('image changes require new Review and scheduling worker processes each due slot once', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const id = (await f.state()).workspace.campaigns[0].id;
  await f.act('approveCampaign', { id }); await f.act('generate', { campaignId: id, plan: await f.plan(id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  const s = await f.state();
  await f.service.changeMarketingImage('123', s.revision, postId, { mime: 'image/png', data: Buffer.from([137,80,78,71,13,10,26,10,0]), source: 'upload' });
  await assert.rejects(() => f.service.publishMarketingPost('123', postId), /chủ shop duyệt/);
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'review', { postId });
  const candidate = (await f.state()).workspace.reviewAttempts.find(item => item.targetPostId === postId);
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'applyReview', { attemptId: candidate.id, draftId: 'draft-0' });
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'approvePost', { postId });
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'schedule', { name: 'Đăng một lần', scenario: 'Một lần', slots: [{ postId, at: Date.now() + 60000 }] });
  const schedule = (await f.state()).workspace.schedules[0];
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'approveSchedule', { id: schedule.id });
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'activateSchedule', { id: schedule.id });
  const ready = await f.state(); ready.workspace.schedules[0].slots[0].at = Date.now() - 1000;
  await f.pool.query('UPDATE marketing_workspaces SET document=$2::jsonb WHERE page_id=$1', ['123', JSON.stringify(ready.workspace)]);
  await f.service.runMarketingSchedules('123'); await f.service.runMarketingSchedules('123');
  assert.equal((await f.state()).workspace.schedules[0].slots[0].status, 'published');
  assert.equal(f.publishes(), 0);
});

test('re-review keeps the approved post and active schedule until the candidate is explicitly applied', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const meta = (await f.state()).workspace.reviews[0], postId = meta.postId;
  await f.act('approvePost', { postId });
  await f.act('schedule', { name: 'Giờ đã duyệt', scenario: 'Một lần', slots: [{ postId, at: Date.now() + 3600000 }] });
  const scheduleId = (await f.state()).workspace.schedules[0].id;
  await f.act('approveSchedule', { id: scheduleId }); await f.act('activateSchedule', { id: scheduleId });
  const before = (await f.service.marketingWorkspaceView('123')).posts[0];
  f.setReviewContent('Giá 221.000đ, inbox để chọn màu phù hợp.');
  await f.act('review', { postId });
  let state = await f.state(); const attempt = state.workspace.reviewAttempts[0];
  assert.equal((await f.service.marketingWorkspaceView('123')).posts[0].content, before.content);
  assert.ok(state.workspace.reviews[0].approvedAt); assert.equal(state.workspace.schedules[0].status, 'active');
  await f.act('applyReview', { attemptId: attempt.id, draftId: 'draft-0' });
  state = await f.state(); assert.equal(state.workspace.reviews[0].approvedAt, null); assert.equal(state.workspace.schedules[0].status, 'paused');
  assert.equal((await f.service.marketingWorkspaceView('123')).posts[0].content, attempt.variants[0].finalDraft.content);
});

test('stale Review candidates cannot overwrite later user edits', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('review', { postId }); const attempt = (await f.state()).workspace.reviewAttempts[0];
  await f.act('editPost', { postId, patch: { content: 'Chỉnh sửa mới của chủ shop' } });
  await assert.rejects(f.act('applyReview', { attemptId: attempt.id, draftId: 'draft-0' }), error => error.status === 409);
  assert.equal((await f.service.marketingWorkspaceView('123')).posts[0].content, 'Chỉnh sửa mới của chủ shop');
});

test('independent Page facts are scoped and changing approved knowledge blocks publication before provider', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.pool.query("INSERT INTO messenger_ai_settings VALUES('other-page',$1::jsonb,1,1)", [JSON.stringify({ ...f.knowledge, products: f.knowledge.products.map(p => ({ ...p, price: 1 })) })]);
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id, plan: await f.plan(campaign.id) });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.pool.query("INSERT INTO messenger_ai_settings VALUES('123',$1::jsonb,1,1)", [JSON.stringify(f.knowledge)]);
  await assert.rejects(f.act('publish', { postId }), /Căn cứ Review đã thay đổi/);
  assert.equal(f.publishes(), 0);
  await f.act('review', { postId }); const attempt = (await f.state()).workspace.reviewAttempts[0];
  assert.ok(attempt.evidence.sources.some(s => s.origin === 'page-knowledge' && s.kind === 'product'));
  assert.ok(attempt.evidence.sources.every(s => s.scope.includes('123') && !s.scope.includes('other-page')));
  await f.act('applyReview', { attemptId: attempt.id, draftId: 'draft-0' }); await f.act('approvePost', { postId });
  await f.pool.query("UPDATE messenger_ai_settings SET knowledge_json=$1::jsonb,updated_at=2 WHERE page_id='123'", [JSON.stringify({ ...f.knowledge, products: f.knowledge.products.map(p => ({ ...p, price: p.price + 1000 })) })]);
  await f.act('review', { postId });
  const conflict = (await f.state()).workspace.reviewAttempts[0];
  assert.equal(conflict.status, 'blocked'); assert.equal(conflict.variants[0].status, 'needs_input'); assert.equal(conflict.variants[0].finalDraft, null);
  assert.ok(conflict.variants[0].issues.some(issue => issue.type === 'conflict'));
});

test('content plan approval is required before writing; binding and approved outline reach Content and Review', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await assert.rejects(f.act('generatePlan', { campaignId: campaign.id }), /Duyệt brief/);
  await f.act('approveCampaign', { id: campaign.id });
  await assert.rejects(f.act('generate', { campaignId: campaign.id }), /Chọn dàn ý/);
  await f.act('generatePlan', { campaignId: campaign.id });
  const plan = (await f.state()).workspace.contentPlans[0];
  const binding = { id: plan.id, version: plan.version, itemId: plan.items[0].id };
  assert.ok(plan.review); assert.equal(plan.approvedAt, null);
  await assert.rejects(f.act('generate', { campaignId: campaign.id, plan: binding }), /Chọn dàn ý/);
  await f.act('approvePlan', { id: plan.id });
  await assert.rejects(f.act('generate', { campaignId: campaign.id, plan: { ...binding, itemId: 'foreign-item' } }), /Chọn dàn ý/);
  await f.act('generate', { campaignId: campaign.id, plan: binding });
  const context = JSON.parse(f.calls.find(c => c.user.includes('DỮ LIỆU CONTENT:\n')).user.split('DỮ LIỆU CONTENT:\n')[1]);
  assert.equal(context.approvedOutline.outline, plan.items[0].outline);
  const post = (await f.state()).workspace.reviews[0];
  assert.deepEqual(post.plan, binding); assert.equal(post.approvedAt, null);
  assert.ok(post.review.evidence.sources.some(s => s.origin === 'content-plan' && s.data.items[0].id === binding.itemId));
  await f.act('approvePost', { postId: post.postId });
  assert.equal(f.publishes(), 0);
});

test('editing a plan invalidates post approval and schedules; stale candidates stay blocked after reapproval', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id });
  const binding = await f.plan(campaign.id);
  await f.act('generate', { campaignId: campaign.id, plan: binding });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.act('schedule', { name: 'Scheduled', scenario: 'One-off', slots: [{ postId, at: Date.now() + 3600000 }] });
  const scheduleId = (await f.state()).workspace.schedules[0].id;
  await f.act('approveSchedule', { id: scheduleId }); await f.act('activateSchedule', { id: scheduleId });
  await f.act('review', { postId });
  const attempt = (await f.state()).workspace.reviewAttempts[0];
  const before = (await f.service.marketingWorkspaceView('123')).posts[0];
  const plan = (await f.state()).workspace.contentPlans[0];
  plan.items[0].outline += '\nAdditional product comparison.';
  await f.act('editPlan', { id: plan.id, plan });
  let state = await f.state();
  assert.equal(state.workspace.reviews[0].approvedAt, null); assert.equal(state.workspace.schedules[0].status, 'paused');
  assert.equal(state.workspace.contentPlans[0].review, undefined);
  await assert.rejects(f.act('approvePlan', { id: plan.id }), /Chờ AI Review/);
  await f.act('reviewPlan', { id: plan.id }); await f.act('approvePlan', { id: plan.id });
  await assert.rejects(f.act('approvePost', { postId }), /Chọn dàn ý/);
  await assert.rejects(f.act('applyReview', { attemptId: attempt.id, draftId: 'draft-0' }), /Chọn dàn ý/);
  await assert.rejects(f.service.publishMarketingPost('123', postId), /Chọn dàn ý/);
  assert.equal((await f.service.marketingWorkspaceView('123')).posts[0].content, before.content);
  state = await f.state();
  const updated = { ...binding, version: state.workspace.contentPlans[0].version };
  await f.act('review', { postId, plan: updated });
  const fresh = (await f.state()).workspace.reviewAttempts[0];
  await f.act('applyReview', { attemptId: fresh.id, draftId: 'draft-0' }); await f.act('approvePost', { postId });
  assert.deepEqual((await f.state()).workspace.reviews[0].plan, updated);
});

test('AI plan rewrite is a separate draft; approving it retires the previous plan without replacing post content', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id });
  const binding = await f.plan(campaign.id);
  await f.act('generate', { campaignId: campaign.id, plan: binding });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.act('generatePlan', { campaignId: campaign.id });
  let state = await f.state();
  assert.ok(state.workspace.contentPlans.find(p => p.id === binding.id).approvedAt);
  assert.ok(state.workspace.reviews[0].approvedAt);
  const proposed = state.workspace.contentPlans[0];
  await f.act('approvePlan', { id: proposed.id });
  state = await f.state();
  assert.equal(state.workspace.contentPlans.find(p => p.id === binding.id).approvedAt, null);
  assert.equal(state.workspace.reviews[0].approvedAt, null);
  await assert.rejects(f.act('generate', { campaignId: campaign.id, plan: binding }), /Chọn dàn ý/);
});

test('plan review failures retain the original and retry safely; plan validation rejects invalid pillar references', async () => {
  const f = await fixture();
  const parser = f.load('lib/services/marketingContentPlan.ts').parseContentPlan;
  assert.throws(() => parser(null));
  assert.throws(() => parser({ pillars: [{ name: 'Value', objective: 'Explain' }], items: [{ pillarIndex: 2, title: 'Post', outline: 'Outline' }] }));
  assert.throws(() => parser({ pillars: [{ name: 'Value', objective: 'Explain' }, { name: 'Unused', objective: 'Unused' }], items: [{ pillarIndex: 0, title: 'Post', outline: 'Outline' }] }));
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); f.failReview();
  await f.act('generatePlan', { campaignId: campaign.id });
  let plan = (await f.state()).workspace.contentPlans[0];
  assert.equal(plan.review.status, 'failed'); assert.ok(plan.items[0].outline);
  await assert.rejects(f.act('approvePlan', { id: plan.id }), /Chờ AI Review/);
  f.restoreReview(); const before = f.calls.length;
  await f.act('reviewPlan', { id: plan.id });
  assert.equal(f.calls.length, before + 1);
  plan = (await f.state()).workspace.contentPlans[0];
  assert.equal(plan.review.status, 'completed');
  await f.act('approvePlan', { id: plan.id });
  await f.act('campaign', { id: campaign.id, brief: { ...f.brief, accountId: '123', message: 'Changed brief' }, knowledge: f.knowledge, configuration: f.config });
  await f.act('approveCampaign', { id: campaign.id });
  await assert.rejects(f.act('generate', { campaignId: campaign.id, plan: { id: plan.id, version: plan.version, itemId: plan.items[0].id } }), /Chọn dàn ý/);
});

test('source changes during plan Review retain a blocked plan and require fresh Review', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id });
  f.onReview(() => f.pool.query("INSERT INTO messenger_ai_settings VALUES('123',$1::jsonb,1,1)", [JSON.stringify(f.knowledge)]));
  await f.act('generatePlan', { campaignId: campaign.id });
  const plan = (await f.state()).workspace.contentPlans[0];
  assert.ok(plan.items[0].outline); assert.equal(plan.review.status, 'blocked');
  assert.ok(plan.review.variants.every(v => !v.finalDraft && v.issues.some(i => i.type === 'conflict')));
  await assert.rejects(f.act('approvePlan', { id: plan.id }), /Căn cứ Review đã thay đổi/);
  await f.act('reviewPlan', { id: plan.id }); await f.act('approvePlan', { id: plan.id });
  assert.ok((await f.state()).workspace.contentPlans[0].approvedAt);
});

test('approving a plan keeps the owner outline; Review only suggests. Channel sample posts reach Review evidence', async () => {
  const f = await fixture();
  const profile = { ...f.briefApi.emptyMarketingProfile(), name: 'Fanpage', samples: ['Chào cả nhà, shop về mẫu mới nè!', '  '] };
  await assert.rejects(f.act('profile', { accountId: '123', profile: { ...profile, samples: Array(6).fill('x') } }), /Tối đa 5/);
  await f.act('profile', { accountId: '123', profile });
  assert.deepEqual((await f.state()).workspace.profiles['123'].samples, ['Chào cả nhà, shop về mẫu mới nè!']);
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id });
  f.setOutlineReview('AI rewrite of the outline');
  await f.act('generatePlan', { campaignId: campaign.id });
  const plan = (await f.state()).workspace.contentPlans[0];
  assert.equal(plan.review.variants[0].finalDraft.content, 'AI rewrite of the outline');
  await f.act('approvePlan', { id: plan.id });
  const approved = (await f.state()).workspace.contentPlans[0];
  assert.ok(approved.approvedAt); assert.equal(approved.items[0].outline, plan.items[0].outline);
  const account = f.service.marketingAccounts('123')[0];
  const catalog = await f.load('lib/services/marketingReviewSources.ts').marketingReviewCatalog('123', (await f.state()).workspace.campaigns[0], account, f.pool);
  assert.deepEqual(catalog.find(source => source.id === 'campaign:samples')?.data.samples, ['Chào cả nhà, shop về mẫu mới nè!']);
});
