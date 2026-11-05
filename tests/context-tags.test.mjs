import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture() {
  const db = {};
  let fail = false;
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name === './mockDb' ? {
      readDb: () => db,
      writeDb: mutate => { if (fail) throw new Error('Storage full'); mutate(db); },
    } : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return { ...load('lib/services/contextTags.ts'), db, failWrites: () => { fail = true; } };
}

test('matches Vietnamese without case or accents, whole phrases, enabled rules only', () => {
  const f = fixture();
  assert.deepEqual(f.matchContextTags('TOI MUON DAT HANG! Phi ship?', f.DEFAULT_CONTEXT_TAG_RULES).map(tag => tag.label), ['Muốn đặt hàng', 'Hỏi giao hàng']);
  const rules = [{ id: 'one', label: 'Size M', keywords: ['m'], type: 'neutral', enabled: true }];
  assert.equal(f.matchContextTags('mình muốn mua', rules).length, 0);
  assert.equal(f.matchContextTags('size M!', rules).length, 1);
  assert.equal(f.matchContextTags('đặt hàng', f.DEFAULT_CONTEXT_TAG_RULES.map(rule => ({ ...rule, enabled: false }))).length, 0);
});

test('validates and persists CRUD, empty configuration stays empty, failed saves preserve rules', () => {
  const f = fixture();
  assert.equal(f.readContextTagRules().length, 4);
  const rule = { id: 'custom', label: '  Áo khoác ', keywords: ['áo khoác', ' áo khoác ', ''], type: 'loop', enabled: true };
  f.saveContextTagRules([rule]);
  assert.deepEqual(f.readContextTagRules()[0], { ...rule, label: 'Áo khoác', keywords: ['áo khoác'] });
  assert.throws(() => f.saveContextTagRules([rule, { ...rule, id: 'duplicate' }]));
  for (const patch of [{ label: '' }, { keywords: [] }, { keywords: ['!!!'] }, { type: 'invalid' }, { enabled: 'yes' }]) assert.throws(() => f.validateContextTagRule({ ...rule, ...patch }));
  f.saveContextTagRules([]);
  assert.deepEqual(f.readContextTagRules(), []);
  f.failWrites();
  assert.throws(() => f.saveContextTagRules([rule]), /Storage full/);
  assert.deepEqual(f.readContextTagRules(), []);
});

test('replaces stale context tags using latest customer message and preserves AI/VIP tags', () => {
  const f = fixture();
  const vip = { label: 'VIP', type: 'vip' }, ai = { label: 'Tích cực', type: 'positive', source: 'ai' };
  const old = { label: 'Đổi trả', type: 'risk', source: 'rule', kind: 'context' };
  const conversation = { tags: [vip, ai, old], profile: { tags: [vip, old] }, messages: [
    { sender: 'in', text: 'hoàn tiền' }, { sender: 'in', text: 'phí ship bao nhiêu?' }, { sender: 'out', text: 'đặt hàng' },
  ] };
  const result = f.applyContextTags(conversation, f.DEFAULT_CONTEXT_TAG_RULES);
  assert.deepEqual(result.tags.map(tag => tag.label), ['VIP', 'Tích cực', 'Hỏi giao hàng']);
  assert.deepEqual(result.profile.tags.map(tag => tag.label), ['VIP', 'Hỏi giao hàng']);
  assert.equal(conversation.tags.length, 3);
  assert.deepEqual(f.applyContextTags(result, []).tags, [vip, ai]);
});
