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
const { autoReview } = loaded.exports;

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
