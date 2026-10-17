/** Browser-only demo state. This is not server authentication or platform authorization. */
export type MockPlatform = 'messenger' | 'zalo' | 'tiktok' | 'shopee';
export type WorkspaceAvatar = 'initial' | 'flower' | 'heart' | 'shop';
export type WorkspaceTone = 'coral' | 'sage' | 'sand';
export interface MockWorkspace { name: string; industry: string; timezone: string; avatar?: WorkspaceAvatar; avatarTone?: WorkspaceTone }
export interface MockOnboarding {
  version: 1;
  workspace: MockWorkspace | null;
  connections: Partial<Record<MockPlatform, string>>;
  completed: boolean;
}

const DATA_KEY = 'tendly.onboarding.mock.v1';
const SESSION_KEY = 'tendly.onboarding.mock.session';
const CHANGE_EVENT = 'tendly:onboarding-changed';
const PLATFORMS: MockPlatform[] = ['messenger', 'zalo', 'tiktok', 'shopee'];
const empty = (): MockOnboarding => ({ version: 1, workspace: null, connections: {}, completed: false });

export function readMockOnboarding(): MockOnboarding {
  try {
    const data = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
    if (!data || data.version !== 1) return empty();
    const workspace = data.workspace && typeof data.workspace.name === 'string'
      && data.workspace.name.trim() && typeof data.workspace.industry === 'string'
      && typeof data.workspace.timezone === 'string' ? {
        name: data.workspace.name,
        industry: data.workspace.industry,
        timezone: data.workspace.timezone,
        ...(['initial', 'flower', 'heart', 'shop'].includes(data.workspace.avatar) ? { avatar: data.workspace.avatar as WorkspaceAvatar } : {}),
        ...(['coral', 'sage', 'sand'].includes(data.workspace.avatarTone) ? { avatarTone: data.workspace.avatarTone as WorkspaceTone } : {}),
      } : null;
    const connections: MockOnboarding['connections'] = {};
    if (workspace) for (const platform of PLATFORMS) {
      if (typeof data.connections?.[platform] === 'string' && data.connections[platform].trim()) connections[platform] = data.connections[platform];
    }
    return { version: 1, workspace, connections, completed: !!workspace && data.completed === true };
  } catch { return empty(); }
}

function save(data: MockOnboarding) {
  // Let the UI show a recoverable error when browser storage is unavailable.
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function loginMock(username: string, password: string): boolean {
  if (username.trim() !== 'admin' || password !== 'admin123') return false;
  save({ ...readMockOnboarding(), completed: false });
  sessionStorage.setItem(SESSION_KEY, 'admin');
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function logoutMock() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isMockLoggedIn(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === 'admin'; } catch { return false; }
}

export function saveMockWorkspace(workspace: MockWorkspace) {
  if (!workspace.name.trim() || workspace.name.trim().length > 80 || !workspace.industry.trim() || !workspace.timezone.trim()) throw new Error('Thông tin shop chưa hợp lệ.');
  if ((workspace.avatar && !['initial', 'flower', 'heart', 'shop'].includes(workspace.avatar)) || (workspace.avatarTone && !['coral', 'sage', 'sand'].includes(workspace.avatarTone))) throw new Error('Biểu tượng shop chưa hợp lệ.');
  save({ ...readMockOnboarding(), workspace: { ...workspace, name: workspace.name.trim() } });
}

export function connectMockPlatform(platform: MockPlatform, account: string | null) {
  const data = readMockOnboarding();
  if (!data.workspace) throw new Error('Bạn cần tạo shop trước khi kết nối.');
  if (!PLATFORMS.includes(platform) || (account !== null && !account.trim())) throw new Error('Tài khoản kết nối chưa hợp lệ.');
  if (account === null) delete data.connections[platform];
  else data.connections[platform] = account.trim();
  save(data);
}

export function completeMockOnboarding() {
  const data = readMockOnboarding();
  if (!data.workspace) throw new Error('Bạn cần tạo shop trước.');
  save({ ...data, completed: true });
}

export function subscribeMockOnboarding(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => { window.removeEventListener(CHANGE_EVENT, callback); window.removeEventListener('storage', callback); };
}

export function mockOnboardingSnapshot(): string {
  return JSON.stringify([isMockLoggedIn(), readMockOnboarding()]);
}
