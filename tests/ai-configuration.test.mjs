import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function fixture() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const source = ts.transpileModule(readFileSync('lib/services/aiConfiguration.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', source)(loadedModule, loadedModule.exports);
  return { api: loadedModule.exports, values };
}

test('five roles start disabled and profile edits do not alter other roles or defaults', () => {
  const { api } = fixture();
  const config = api.defaultAiConfiguration();
  assert.equal(Object.keys(config.profiles).length, 5);
  assert.ok(Object.values(config.profiles).every(p => p.enabled === false));
  assert.equal(config.binding.enabled, false);
  config.profiles.chat.goal = 'Tư vấn riêng';
  config.profiles.chat.sources.pop();
  assert.notEqual(config.profiles.content.goal, 'Tư vấn riêng');
  assert.equal(api.defaultAiConfiguration().profiles.chat.sources.length, 4);
});

test('save and reload preserve roles and draft binding per account without touching legacy knowledge', () => {
  const { api, values } = fixture();
  values.set('tendly.mockdb', '{"products":["keep"]}');
  const config = api.readAiConfiguration('owner-a');
  config.profiles.chat.name = '  Tư vấn Nhà Linh  ';
  config.profiles.chat.enabled = true;
  config.profiles.chat.mode = 'auto';
  config.binding = { pageName: 'Page minh họa', enabled: true, mode: 'assist' };
  const saved = api.saveAiConfiguration(config, 'owner-a');
  assert.equal(saved.profiles.chat.name, 'Tư vấn Nhà Linh');
  assert.ok(saved.updatedAt > 0);
  assert.deepEqual(api.readAiConfiguration('owner-a'), saved);
  assert.equal(api.readAiConfiguration('owner-b').profiles.chat.enabled, false);
  assert.equal(values.get('tendly.mockdb'), '{"products":["keep"]}');
});

test('validation rejects missing roles, unsupported sources, invalid modes and incomplete bindings', () => {
  const { api } = fixture();
  for (const mutate of [
    c => { delete c.profiles.chat; },
    c => { c.profiles.chat.sources = ['market']; },
    c => { c.profiles.content.mode = 'auto'; },
    c => { c.profiles.review.enabled = 'true'; },
    c => { c.profiles.chat.goal = '  '; },
    c => { c.profiles.chat.name = 'x'.repeat(101); },
    c => { c.binding.enabled = true; },
    c => { c.binding.mode = 'anything'; },
    c => { c.version = 2; },
    c => { c.updatedAt = NaN; },
  ]) {
    const config = api.defaultAiConfiguration(); mutate(config);
    assert.throws(() => api.parseAiConfiguration(config));
  }
});

test('invalid edits or storage failures do not replace the last saved configuration', () => {
  const { api, values } = fixture();
  api.saveAiConfiguration(api.defaultAiConfiguration(), 'owner');
  const before = values.get('tendly.ai-configuration.v1:owner');
  const config = api.readAiConfiguration('owner');
  config.profiles.content.output = '';
  assert.throws(() => api.saveAiConfiguration(config, 'owner'));
  assert.equal(values.get('tendly.ai-configuration.v1:owner'), before);
  globalThis.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => api.saveAiConfiguration(api.defaultAiConfiguration(), 'owner'), /quota/);
  assert.equal(values.get('tendly.ai-configuration.v1:owner'), before);
});

test('corrupt or unsupported saved data is reported without silently overwriting it', () => {
  const { api, values } = fixture();
  for (const raw of ['not json', JSON.stringify({ version: 2 })]) {
    values.set('tendly.ai-configuration.v1:owner', raw);
    assert.throws(() => api.readAiConfiguration('owner'));
    assert.equal(values.get('tendly.ai-configuration.v1:owner'), raw);
  }
  assert.throws(() => api.readAiConfiguration(''));
});
