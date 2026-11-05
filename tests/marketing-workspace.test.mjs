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
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  let publishes = 0;
  let failPublication = false, failReview = false;
  const calls = [];
  const cache = new Map();
  const load = file => {
    if (file === 'lib/services/appSecurity.ts') return { assertOperationAllowed: async () => {}, runAutomaticAccess: (_at, fn) => fn() };
    if (file === 'lib/services/messengerPostgres.ts') return { getMessengerPool: () => pool };
    if (file === 'lib/services/facebookPage.ts') return { publishToFacebookPage: async () => { publishes++; if (failPublication) throw new Error('Connection lost after send'); return { id: '123_456', url: 'https://www.facebook.com/123_456' }; } };
    if (file === 'lib/services/gemini.ts') return { generateGeminiJson: async options => {
      calls.push(options);
      const review = options.system.startsWith('Bạn là AI Review');
      if (review && failReview) throw new Error('Review timeout');
      const draft = { title: 'Áo thun', content: review ? 'Giá 221.000đ, nhắn tin để tư vấn.' : 'Giá 259.000đ.', hashtags: [], imageIdea: 'Ảnh áo', imagePrompt: '' };
      const variants = review ? [{ id: 0, status: 'corrected', draft, changes: ['Sửa giá theo nguồn'], issues: [] }] : [draft];
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
  return { load, service, briefApi, config, knowledge, brief, act, state, pool, publishes: () => publishes, calls,
    failPublication: () => { failPublication = true; }, failReview: () => { failReview = true; } };
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

test('campaign → Review → owner approval → mock publication never calls Facebook', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await assert.rejects(() => f.act('generate', { campaignId: campaign.id }), /Duyệt brief/);
  await f.act('approveCampaign', { id: campaign.id });
  await f.act('generate', { campaignId: campaign.id });
  let meta = (await f.state()).workspace.reviews[0];
  await assert.rejects(() => f.act('publish', { postId: meta.postId }), /chủ shop duyệt/);
  await f.act('approvePost', { postId: meta.postId });
  await f.act('publish', { postId: meta.postId });
  meta = (await f.state()).workspace.reviews[0];
  assert.equal(meta.publication, 'published');
  assert.equal(f.publishes(), 0);
  await assert.rejects(() => f.act('publish', { postId: meta.postId }), /không gửi lại/);
});

test('editing or changing Page profile invalidates approval and stale writes are rejected', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  await f.act('editPost', { postId, patch: { content: 'Bản đã sửa' } });
  await assert.rejects(() => f.act('approvePost', { postId }), /Review lại/);
  await f.act('review', { postId }); await f.act('approvePost', { postId });
  const old = (await f.state()).revision;
  await f.act('profile', { accountId: 'sample-instagram', profile: { ...f.briefApi.emptyMarketingProfile(), name: 'Kênh khác' } });
  await assert.rejects(() => f.service.marketingWorkspaceAction('123', 'owner', old, 'approvePost', { postId }), /Tải lại/);
  await assert.rejects(() => f.act('publish', { postId }), /Brief đã thay đổi/);
});

test('schedule requires separate approval and activation and blocks changed content', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: f.brief, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id });
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
  const item = { id: 0, status: 'corrected', draft, changes: ['Sửa giá theo nguồn'], issues: [] };
  assert.equal(api.parseMarketingReview(JSON.stringify({ variants: [item] }), 1)[0].draft.content, draft.content);
  assert.throws(() => api.parseMarketingReview(JSON.stringify({ variants: [{ ...item, id: 1 }] }), 1));
  assert.throws(() => api.parseMarketingReview(JSON.stringify({ variants: [item, item] }), 2));
  assert.throws(() => api.parseMarketingReview('not json', 1));
});

test('Facebook uses the same source for Content/Review and publishes only after owner approval', async () => {
  const f = await fixture();
  await f.act('campaign', { brief: { ...f.brief, accountId: '123' }, knowledge: f.knowledge, configuration: f.config });
  const campaign = (await f.state()).workspace.campaigns[0];
  await f.act('approveCampaign', { id: campaign.id }); await f.act('generate', { campaignId: campaign.id });
  assert.equal(f.calls.length, 2);
  const contentSource = JSON.parse(f.calls[0].user.split('DỮ LIỆU CHUNG:\n')[1]);
  assert.deepEqual(contentSource, JSON.parse(f.calls[1].user).context);
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
  await f.act('approveCampaign', { id: campaign.id }); f.failReview();
  await assert.rejects(() => f.act('generate', { campaignId: campaign.id }), /Review timeout/);
  assert.equal((await f.state()).workspace.reviews.length, 0);
  assert.equal((await f.service.marketingWorkspaceView('123')).posts.length, 0);
  const g = await fixture();
  await g.act('campaign', { brief: { ...g.brief, accountId: '123' }, knowledge: g.knowledge, configuration: g.config });
  const id = (await g.state()).workspace.campaigns[0].id;
  await g.act('approveCampaign', { id }); await g.act('generate', { campaignId: id });
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
  await f.act('approveCampaign', { id }); await f.act('generate', { campaignId: id });
  const postId = (await f.state()).workspace.reviews[0].postId;
  await f.act('approvePost', { postId });
  const s = await f.state();
  await f.service.changeMarketingImage('123', s.revision, postId, { mime: 'image/png', data: Buffer.from([137,80,78,71,13,10,26,10,0]), source: 'upload' });
  await assert.rejects(() => f.service.publishMarketingPost('123', postId), /chủ shop duyệt/);
  await f.service.marketingWorkspaceAction('123', 'owner', (await f.state()).revision, 'review', { postId });
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
