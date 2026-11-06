import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function render(channels) {
  const react = require('react');
  let state = 0;
  const dependencies = {
    react: { ...react, useEffect: () => {}, useState: initial => [state++ === 0 ? channels : initial, () => {}] },
    '@/components/ui/Modal': { ConfirmDialog: () => null },
    '@/components/ui/Switch': { Switch: props => createElement('input', { type: 'checkbox', checked: props.checked, disabled: props.disabled, 'aria-label': props.label, readOnly: true }) },
    '@/components/shared/ToastProvider': { useToast: () => () => {} },
    '@/lib/services/api': {},
  };
  const source = ts.transpileModule(readFileSync('components/features/settings/ChannelsTab.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => dependencies[name] ?? require(name), loaded, loaded.exports);
  return renderToStaticMarkup(createElement(loaded.exports.ChannelsTab));
}

test('channel settings group existing and sample accounts under the correct platforms', () => {
  const channels = [
    { id: 'messenger', name: 'Messenger', connected: true, enabled: true, account: 'Fanpage Tendly' },
    { id: 'zalo', name: 'Zalo OA', connected: false, enabled: false, account: null },
    { id: 'tiktok', name: 'TikTok Shop', connected: false, enabled: false, account: null, comingSoon: true },
  ];
  const html = render(channels);
  for (const [platform, names] of [['Facebook', ['Fanpage Tendly', 'Tendly Studio']], ['Zalo OA', ['Tendly Official', 'Tendly Chăm sóc khách hàng']], ['TikTok Shop', ['@tendly', '@tendly.studio']]]) {
    const list = html.match(new RegExp(`<ul[^>]+aria-label="Trang và tài khoản ${platform}"[^>]*>(.*?)</ul>`))?.[1];
    assert.ok(list, platform);
    for (const name of names) assert.ok(list.includes(name), name);
  }
  assert.match(html, /Bật\/tắt Facebook/);
  assert.match(html, /Sắp ra mắt/);
  assert.match(render([{ ...channels[0], account: 'Page riêng của shop' }]), /Page riêng của shop/);
  assert.equal((render([{ ...channels[0], account: 'Tendly Studio' }]).match(/<li>/g) ?? []).length, 1);
  assert.match(render([{ ...channels[0], connected: false, account: null }]), /Fanpage Tendly/);
  assert.match(render(null), /skeleton/);
});
