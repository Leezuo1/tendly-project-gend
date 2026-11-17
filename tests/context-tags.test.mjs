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
  for (const patch of [{ label: '' }, { keywords: Array.from({ length: 21 }, (_, i) => `k${i}`) }, { keywords: ['!!!'] }, { type: 'invalid' }, { enabled: 'yes' }]) assert.throws(() => f.validateContextTagRule({ ...rule, ...patch }));
  f.saveContextTagRules([]);
  assert.deepEqual(f.readContextTagRules(), []);
  f.failWrites();
  assert.throws(() => f.saveContextTagRules([rule]), /Storage full/);
  assert.deepEqual(f.readContextTagRules(), []);
});

test('a label with no keywords is valid and never matches', () => {
  const f = fixture();
  const rule = f.validateContextTagRule({ id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true });
  assert.deepEqual(rule.keywords, []);
  assert.equal(f.matchContextTags('khách sỉ', [rule]).length, 0);
  assert.equal(f.matchContextTags('đặt hàng', f.DEFAULT_CONTEXT_TAG_RULES)[0].id, 'buy');
});

test('nextStaffLabels adds, removes, hides, re-adds a hidden label and drops deleted ids', () => {
  const f = fixture();
  const rules = f.DEFAULT_CONTEXT_TAG_RULES, start = { added: ['buy', 'gone'], hidden: ['delivery'] };
  assert.deepEqual(f.nextStaffLabels(start, { type: 'add', id: 'delivery' }, rules), { added: ['buy', 'delivery'], hidden: [] });
  assert.deepEqual(f.nextStaffLabels(start, { type: 'removeStaff', id: 'buy' }, rules), { added: [], hidden: ['delivery', 'buy'] }, 'also hidden, so a keyword match does not bring it straight back');
  assert.deepEqual(f.nextStaffLabels(start, { type: 'hideRule', id: 'returns' }, rules), { added: ['buy'], hidden: ['delivery', 'returns'] });
  assert.deepEqual(f.nextStaffLabels(start, { type: 'add', id: 'buy' }, rules), { added: ['buy'], hidden: ['delivery'] });
  assert.deepEqual(f.nextStaffLabels(undefined, { type: 'add', id: 'buy' }, rules), { added: ['buy'], hidden: [] });
  for (const type of ['add', 'hideRule']) assert.deepEqual(f.nextStaffLabels(start, { type, id: 'unknown' }, rules), { added: ['buy'], hidden: ['delivery'] }, `${type} of an id outside the set changes nothing`);
});

test('a label carries an optional trimmed context for the AI, at most 500 characters', () => {
  const f = fixture();
  const base = { id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true };
  assert.equal(f.validateContextTagRule({ ...base, context: '  Mua từ 10 cái, báo giá sỉ.  ' }).context, 'Mua từ 10 cái, báo giá sỉ.');
  assert.equal('context' in f.validateContextTagRule({ ...base, context: '   ' }), false, 'an empty context is not stored');
  assert.equal('context' in f.validateContextTagRule(base), false);
  assert.equal(f.validateContextTagRule({ ...base, context: 'a'.repeat(500) }).context.length, 500);
  assert.throws(() => f.validateContextTagRule({ ...base, context: 'a'.repeat(501) }), /500/);
  assert.throws(() => f.validateContextTagRule({ ...base, context: 5 }));
});

test('a saved label keeps only its own fields', () => {
  const f = fixture();
  const rule = f.validateContextTagRule({ id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true, secret: 'x', __proto__x: 1 });
  assert.deepEqual(Object.keys(rule).sort(), ['enabled', 'id', 'keywords', 'label', 'type']);
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

test('staff and AI labels merge with rule labels: one chip per label, staff > AI > rule, hidden stays hidden, deleted rules vanish', () => {
  const f = fixture();
  const rules = f.DEFAULT_CONTEXT_TAG_RULES;
  const base = { tags: [{ label: 'VIP', type: 'vip' }], profile: { tags: [] }, messages: [{ sender: 'in', text: 'phí ship bao nhiêu' }],
    staffLabels: { added: ['returns', 'buy', 'gone'], hidden: ['delivery'] } };
  let result = f.applyContextTags(base, rules);
  assert.deepEqual(result.tags.map(tag => [tag.label, tag.source, tag.id]), [['VIP', undefined, undefined], ['Đổi trả', 'staff', 'returns'], ['Muốn đặt hàng', 'staff', 'buy']]);
  result = f.applyContextTags({ ...result, messages: [...base.messages, { sender: 'in', text: 'đặt hàng nhé, phí ship?' }] }, rules);
  assert.deepEqual(result.tags.filter(tag => tag.kind === 'context').map(tag => [tag.label, tag.source]), [['Đổi trả', 'staff'], ['Muốn đặt hàng', 'staff']], 'rule match on a staff label shows once; hidden rule label stays hidden');
  const ai = f.applyContextTags({ ...base, staffLabels: { added: ['buy'], hidden: ['delivery'] }, analysis: { labels: ['product', 'delivery', 'buy'] },
    messages: [{ sender: 'in', text: 'chọn size giúp mình' }] }, rules);
  assert.deepEqual(ai.tags.filter(tag => tag.kind === 'context').map(tag => [tag.label, tag.source]), [['Muốn đặt hàng', 'staff'], ['Tư vấn sản phẩm', 'ai']], 'AI label beats the matching rule label, hidden AI label not shown');
  assert.deepEqual(ai.profile.tags.map(tag => tag.label), ['Muốn đặt hàng', 'Tư vấn sản phẩm']);
});
