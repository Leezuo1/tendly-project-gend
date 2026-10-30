import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file) {
  const loadedModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', compiled)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test('every setup industry has distinct keywords, related products and sourcing demo data', () => {
  const { industries } = load('lib/data/workspace.ts');
  const { sourcingDemos } = load('lib/data/smartSourcing.ts');
  assert.deepEqual(Object.keys(sourcingDemos), industries);
  const allKeywords = new Set();
  for (const industry of industries) {
    const demo = sourcingDemos[industry];
    assert.ok(demo.products.length >= 2, industry);
    assert.ok(demo.suppliers.length >= 2, industry);
    for (const product of demo.products) {
      assert.ok(product.name && product.keyword && product.signal && product.channel, industry);
      assert.ok(product.price && product.minOrder, product.name);
      assert.ok(Number.isFinite(product.mentions) && product.mentions > 0, product.name);
      assert.ok(Number.isFinite(product.growth) && product.growth > 0, product.name);
      assert.ok(!allKeywords.has(product.keyword), `keyword must belong to one demo industry: ${product.keyword}`);
      allKeywords.add(product.keyword);
    }
    for (const supplier of demo.suppliers) {
      assert.ok(supplier.name && supplier.location && supplier.leadTime && supplier.query, industry);
    }
  }
});
