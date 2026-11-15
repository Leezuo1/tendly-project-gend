import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync('components/features/marketing/MarketingWorkspace.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', source)(name => name.startsWith('@/') || name.startsWith('./') ? {} : require(name), loaded, loaded.exports);
const { autoReview, reviewedPlan, nextAutoReview } = loaded.exports;

const view = (overrides = {}) => ({ workspace: {
  campaigns: [{ id: 'c1', version: 2, approvedAt: 1 }],
  contentPlans: [{ id: 'old', campaignId: 'c1', campaignVersion: 1, approvedAt: 1, version: 1, items: [{ id: 'x' }] },
    { id: 'p1', campaignId: 'c1', campaignVersion: 2, approvedAt: 1, version: 3, items: [{ id: 'i1' }, { id: 'i2' }] }],
  reviews: [{ postId: 'post', campaignId: 'c1', publication: 'draft', plan: { id: 'p1', itemId: 'i2' } }],
  ...overrides } });

test('Review runs automatically after the shop edits a post, plan or image', () => {
  assert.deepEqual(autoReview('editPost', { postId: 'post' }, view()), { action: 'review', input: { postId: 'post', plan: { id: 'p1', version: 3, itemId: 'i2' } } });
  assert.equal(autoReview('image', { postId: 'post' }, view()).action, 'review');
  assert.deepEqual(autoReview('editPlan', { id: 'p1' }, view()), { action: 'reviewPlan', input: { id: 'p1' } });
  const outdated = view({ reviews: [{ postId: 'post', campaignId: 'c1', publication: 'draft', plan: { id: 'old', itemId: 'x' } }] });
  assert.equal(autoReview('editPost', { postId: 'post' }, outdated).input.plan.itemId, 'i1');
});

test('auto Review is skipped when it cannot run or is not needed', () => {
  assert.equal(autoReview('approvePost', { postId: 'post' }, view()), null);
  assert.equal(autoReview('editPost', { postId: 'post' }, view({ campaigns: [{ id: 'c1', version: 2, approvedAt: null }] })), null);
  assert.equal(autoReview('editPost', { postId: 'post' }, view({ reviews: [{ postId: 'post', campaignId: 'c1', publication: 'published' }] })), null);
  assert.equal(autoReview('editPost', { postId: 'missing' }, view()), null);
});

test('reviewedPlan swaps in the Review suggestions and is null when nothing differs', () => {
  const plan = { items: [{ id: 'a', title: 'T1', outline: 'O1' }, { id: 'b', title: 'T2', outline: 'O2' }],
    review: { variants: [{ finalDraft: { title: 'T1', content: 'O1' } }, { finalDraft: { title: 'T2b', content: 'O2b' } }] } };
  assert.deepEqual(reviewedPlan(plan).items.map(item => [item.id, item.title, item.outline]), [['a', 'T1', 'O1'], ['b', 'T2b', 'O2b']]);
  assert.equal(reviewedPlan({ ...plan, review: { variants: [{ finalDraft: null }, {}] } }), null);
  assert.equal(reviewedPlan({ ...plan, review: undefined }), null);
});

test('nextAutoReview picks missing or failed Review once, and leaves blocked results to the owner', () => {
  const base = view();
  const workspace = (extra = {}) => ({ workspace: { ...base.workspace, contentPlans: [], reviews: [], reviewAttempts: [], ...extra } });
  const plan = { id: 'p9', campaignId: 'c1', campaignVersion: 2, version: 1, approvedAt: null, items: [{ id: 'i1' }] };
  assert.deepEqual(nextAutoReview(workspace({ contentPlans: [plan] }), new Set()), { key: 'plan:p9:1', action: 'reviewPlan', input: { id: 'p9' } });
  assert.equal(nextAutoReview(workspace({ contentPlans: [plan] }), new Set(['plan:p9:1'])), null, 'one try per plan version');
  assert.equal(nextAutoReview(workspace({ contentPlans: [{ ...plan, review: { status: 'completed' } }] }), new Set()), null);
  assert.equal(nextAutoReview(workspace({ contentPlans: [{ ...plan, review: { status: 'failed' } }] }), new Set()).action, 'reviewPlan');
  const attempt = { id: 'a1', status: 'failed', variants: [{ finalDraft: null }] };
  assert.deepEqual(nextAutoReview(workspace({ reviewAttempts: [attempt] }), new Set()), { key: 'attempt:a1', action: 'retryReview', input: { attemptId: 'a1' } });
  assert.equal(nextAutoReview(workspace({ reviewAttempts: [{ ...attempt, status: 'blocked' }] }), new Set()), null, 'blocked needs the owner, not a retry');
  assert.equal(nextAutoReview(workspace({ reviewAttempts: [{ ...attempt, discardedAt: 1 }] }), new Set()), null);
  const stalePost = { postId: 'post', campaignId: 'c1', publication: 'draft', reviewHash: '', reviewedAt: 5, plan: { id: 'p1', itemId: 'i2' } };
  const next = nextAutoReview(view({ reviews: [stalePost] }), new Set());
  assert.equal(next.key, 'post:post:5'); assert.equal(next.action, 'review');
  const waiting = { id: 'a2', status: 'blocked', targetPostId: 'post', variants: [{ finalDraft: null }] };
  assert.equal(nextAutoReview(view({ reviews: [stalePost], reviewAttempts: [waiting] }), new Set()), null, 'a post with a proposal waiting is not reviewed again');
  assert.equal(nextAutoReview(workspace({ contentPlans: [plan] }), new Set(), 'other'), null, 'only the selected campaign');
  const done = { id: 'a3', status: 'completed', targetPostId: 'post', campaignId: 'c1', createdAt: 100, variants: [{ draftId: 'd1', finalDraft: { title: 't', content: 'c' } }] };
  assert.equal(nextAutoReview(view({ reviews: [stalePost], reviewAttempts: [done] }), new Set()), null, 'a finished proposal waits for the owner to apply it; never applied automatically');
});
