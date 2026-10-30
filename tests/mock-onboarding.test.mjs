import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function fixture() {
  const local = new Map();
  const session = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
  globalThis.localStorage = storage(local);
  globalThis.sessionStorage = storage(session);
  globalThis.window = new EventTarget();
  const source = ts.transpileModule(readFileSync('lib/services/mockOnboarding.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = () => { const loadedModule = { exports: {} }; new Function('module', 'exports', source)(loadedModule, loadedModule.exports); return loadedModule.exports; };
  return { api: load(), local, session, load };
}

const shop = { name: '  Tiệm Nhà Linh  ', industry: 'Thời trang & phụ kiện', timezone: 'Asia/Ho_Chi_Minh' };

test('mock login rejects wrong credentials, accepts admin, and never stores the password', () => {
  const { api, local, session } = fixture();
  assert.equal(api.loginMock('admin', 'wrong'), false);
  assert.equal(api.loginMock('someone', 'admin123'), false);
  assert.equal(api.isMockLoggedIn(), false);
  assert.equal(api.loginMock(' admin ', 'admin123'), true);
  assert.equal(api.isMockLoggedIn(), true);
  assert.equal(api.readMockOnboarding().completed, false);
  assert.ok(!JSON.stringify([...local, ...session]).includes('admin123'));
});

test('reload retains setup, and every successful login restarts setup while preserving shop details', () => {
  const { api, local, load } = fixture();
  local.set('tendly.mockdb', '{"existing":"keep"}');
  api.loginMock('admin', 'admin123');
  api.saveMockWorkspace(shop);
  assert.equal(api.readMockOnboarding().workspace.name, 'Tiệm Nhà Linh');
  assert.equal(load().readMockOnboarding().completed, false);
  assert.equal(load().isMockLoggedIn(), true);
  api.connectMockPlatform('messenger', 'Fanpage mẫu');
  api.connectMockPlatform('shopee', 'Shop mẫu');
  assert.deepEqual(load().readMockOnboarding().connections, { messenger: 'Fanpage mẫu', shopee: 'Shop mẫu' });
  api.completeMockOnboarding();
  assert.equal(load().readMockOnboarding().completed, true);
  api.logoutMock();
  assert.equal(api.isMockLoggedIn(), false);
  api.loginMock('admin', 'admin123');
  assert.equal(api.readMockOnboarding().completed, false);
  assert.equal(api.readMockOnboarding().workspace.name, 'Tiệm Nhà Linh');
  assert.deepEqual(api.readMockOnboarding().connections, { messenger: 'Fanpage mẫu', shopee: 'Shop mẫu' });
  api.completeMockOnboarding();
  assert.equal(api.loginMock('admin', 'wrong'), false);
  assert.equal(api.readMockOnboarding().completed, true, 'failed login must not reset saved progress');
  api.loginMock('admin', 'admin123');
  assert.equal(api.readMockOnboarding().completed, false, 'login restarts setup even without an explicit logout');
  assert.equal(local.get('tendly.mockdb'), '{"existing":"keep"}');
});

test('cannot connect or complete before creating a shop; connections can be removed independently', () => {
  const { api } = fixture();
  assert.throws(() => api.connectMockPlatform('zalo', 'Account mẫu'));
  assert.throws(() => api.completeMockOnboarding());
  assert.throws(() => api.saveMockWorkspace({ ...shop, name: ' ' }));
  api.saveMockWorkspace(shop);
  api.connectMockPlatform('zalo', 'Zalo cá nhân mẫu');
  api.connectMockPlatform('tiktok', 'TikTok mẫu');
  api.connectMockPlatform('zalo', null);
  assert.deepEqual(api.readMockOnboarding().connections, { tiktok: 'TikTok mẫu' });
  assert.throws(() => api.connectMockPlatform('unknown', 'Account mẫu'));
  assert.throws(() => api.connectMockPlatform('zalo', ' '));
});

test('workspace appearance and detected timezone survive reload and repeated login', () => {
  const { api, load, local } = fixture();
  api.loginMock('admin', 'admin123');
  api.saveMockWorkspace({ ...shop, timezone: 'Europe/Paris', avatar: 'flower', avatarTone: 'sage' });
  const saved = load().readMockOnboarding().workspace;
  assert.equal(saved.avatar, 'flower');
  assert.equal(saved.avatarTone, 'sage');
  assert.equal(saved.timezone, 'Europe/Paris');
  api.loginMock('admin', 'admin123');
  assert.equal(api.readMockOnboarding().workspace.avatarTone, 'sage');
  assert.throws(() => api.saveMockWorkspace({ ...shop, avatar: 'invalid' }));
  assert.throws(() => api.saveMockWorkspace({ ...shop, avatarTone: 'invalid' }));
  local.set('tendly.onboarding.mock.v1', JSON.stringify({ version: 1, workspace: { ...shop, avatar: 'invalid', avatarTone: 'invalid' } }));
  assert.equal(api.readMockOnboarding().workspace.avatar, undefined);
  assert.equal(api.readMockOnboarding().workspace.avatarTone, undefined);
});

test('skipping platform connections completes onboarding with zero connected accounts', () => {
  const { api } = fixture();
  api.saveMockWorkspace(shop);
  api.completeMockOnboarding();
  assert.equal(api.readMockOnboarding().completed, true);
  assert.deepEqual(api.readMockOnboarding().connections, {});
});

test('corrupted or incomplete browser data returns to shop creation without crashing', () => {
  const { api, local } = fixture();
  local.set('tendly.onboarding.mock.v1', '{not json');
  assert.equal(api.readMockOnboarding().workspace, null);
  local.set('tendly.onboarding.mock.v1', JSON.stringify({ version: 1, workspace: null, connections: { messenger: 'orphan' }, completed: true }));
  assert.equal(api.readMockOnboarding().completed, false);
  assert.deepEqual(api.readMockOnboarding().connections, {});
  assert.equal(api.readMockOnboarding().workspace, null);
});

test('storage errors are reported, and subscriptions update on changes and unsubscribe cleanly', () => {
  const { api } = fixture();
  let changes = 0;
  const unsubscribe = api.subscribeMockOnboarding(() => changes++);
  api.loginMock('admin', 'admin123');
  api.saveMockWorkspace(shop);
  assert.equal(changes, 3);
  assert.equal(api.mockOnboardingSnapshot(), api.mockOnboardingSnapshot());
  unsubscribe();
  api.connectMockPlatform('shopee', 'Shop mẫu');
  assert.equal(changes, 3);
  globalThis.localStorage.setItem = () => { throw new Error('Storage disabled'); };
  assert.throws(() => api.saveMockWorkspace(shop), /Storage disabled/);
});
