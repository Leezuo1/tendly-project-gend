import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
// Same loader seam as the other tests: compile on the fly, resolve '@/x' to 'x.ts'.
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
  return loaded.exports;
}

const { parseJsonObject } = load('lib/http/body.ts');
class Fail extends Error {}

test('parseJsonObject returns plain objects', () => {
  assert.deepEqual(parseJsonObject('{"a":1}', () => new Fail()), { a: 1 });
});

test('parseJsonObject rejects null, arrays, scalars and broken JSON with the caller error', () => {
  for (const raw of ['null', '[]', '"x"', '1', '{oops', '']) {
    assert.throws(() => parseJsonObject(raw, () => new Fail('bad')), error => error instanceof Fail && error.message === 'bad', raw);
  }
});
