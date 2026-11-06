import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const profile = { platformRules: {}, rules: {} };

function render(settings, mode = 'manage') {
  let state = 0;
  const react = require('react');
  const dependencies = {
    react: { ...react, useState: initial => [state++ === 0 ? settings : typeof initial === 'function' ? initial() : initial, () => {}], useEffect: () => {}, useCallback: fn => fn },
    'next/link': { default: props => createElement('a', props) },
    '@/components/ui/Switch': { Switch: props => createElement('input', { type: 'checkbox', checked: props.checked, disabled: props.disabled, 'aria-label': props.label, readOnly: true }) },
    '@/components/shared/ToastProvider': { useToast: () => () => {} },
    '@/lib/services/postsClient': {},
    '@/lib/services/aiChat': {},
    '@/lib/services/aiConfiguration': { defaultAiConfiguration: () => ({ profiles: { chat: profile } }), AI_RULE_FIELDS: { chat: [] } },
    './ai-configuration.module.css': { default: {} },
  };
  const source = ts.transpileModule(readFileSync('components/features/ai-config/CustomerCareSettings.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => dependencies[name] ?? require(name), loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.CustomerCareSettings, { mode, initialProfile: profile }));
}

test('AI Chat explains incomplete setup and links to the activation form', () => {
  const ready = { autoReply: false, profile, pageAssigned: true, pageEnabled: true };
  for (const patch of [{ profile: null }, { pageAssigned: false }, { pageEnabled: false }]) {
    const html = render({ ...ready, ...patch });
    assert.match(html, /Chưa thể bật AI Chat/);
    assert.match(html, /Xác nhận &amp; áp dụng AI Chat/);
    assert.match(html, /href="\/cau-hinh-ai\?tab=settings&amp;ai=chat">Thiết lập để bật AI Chat/);
  }
  for (const settings of [null, ready, { ...ready, autoReply: true }]) {
    assert.doesNotMatch(render(settings), /Chưa thể bật AI Chat|Thiết lập để bật AI Chat/);
  }
  assert.doesNotMatch(render(ready), /disabled=""/);
  for (const settings of [null, ready, { ...ready, autoReply: true }]) {
    assert.doesNotMatch(render(settings), /<input/);
  }
  assert.match(render(ready, 'settings'), /aria-label="Bật AI Chat"/);
});
