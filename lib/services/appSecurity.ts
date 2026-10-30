import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import type { AppSession } from '@/lib/types/security';

type Database = Pick<Pool, 'query'>;
type Actor = { request: Request } | { automaticAt: number };
const actors = new AsyncLocalStorage<Actor>();
const derive = promisify(scrypt);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const APP_SESSION_COOKIE = 'tendly_app_session';
const SESSION_SECONDS = 8 * 3600;

export class AppSecurityError extends Error {
  constructor(message: string, readonly status = 403, readonly code = 'APP_PROTECTED') { super(message); }
}
export function securityErrorResponse(error: AppSecurityError) {
  return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new AppSecurityError('Nguồn truy cập không hợp lệ.', 403, 'BAD_ORIGIN');
  }
}
export async function readSecurityJson(request: Request): Promise<Record<string, unknown>> {
  sameOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new AppSecurityError('Nội dung yêu cầu không hợp lệ.', 400, 'INVALID_JSON');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new AppSecurityError('Nội dung yêu cầu quá lớn.', 413, 'BODY_TOO_LARGE'); }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON');
    return data;
  } catch (error) {
    if (error instanceof AppSecurityError) throw error;
    throw new AppSecurityError('Nội dung yêu cầu không hợp lệ.', 400, 'INVALID_JSON');
  } finally { reader.releaseLock(); }
}
export function sessionCookie(request: Request, token = '') {
  return `${APP_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function requestToken(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${APP_SESSION_COOKIE}=`))?.slice(APP_SESSION_COOKIE.length + 1) || '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}
function account(role: 'admin' | 'user') {
  return role === 'admin'
    ? { username: process.env.APP_ADMIN_USERNAME?.trim() || '', password: process.env.APP_ADMIN_PASSWORD_HASH || '' }
    : { username: 'admin', password: 'admin123' };
}
function credentialHash(role: 'admin' | 'user') {
  const value = account(role);
  return hash(`${role}:${value.username}:${value.password}`);
}
async function verifyPassword(password: string, encoded: string) {
  const parts = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  if (!parts) return false;
  return timingSafeEqual(await derive(password, parts[1], 64) as Buffer, Buffer.from(parts[2], 'hex'));
}
export async function readProtection(db: Database = getMessengerPool()) {
  try {
    const row = (await db.query('SELECT * FROM app_security_settings WHERE id=1')).rows[0];
    if (!row) throw new Error('Missing security settings');
    return { protectionEnabled: row.protection_enabled !== false, revision: Number(row.revision),
      updatedAt: Number(row.updated_at), updatedBy: String(row.updated_by), automaticAfter: Number(row.automatic_after) };
  } catch { throw new AppSecurityError('Chưa đọc được cấu hình bảo vệ. Chức năng dữ liệu thật đang khóa.', 503, 'SECURITY_UNAVAILABLE'); }
}
async function readIdentity(request: Request, db: Database) {
  const token = requestToken(request);
  if (!token) return null;
  const row = (await db.query('SELECT role,username,credential_hash FROM app_sessions WHERE token_hash=$1 AND expires_at>$2', [hash(token), Date.now()])).rows[0];
  if (!row || (row.role !== 'admin' && row.role !== 'user') || row.credential_hash !== credentialHash(row.role)) return null;
  return { role: row.role as 'admin' | 'user', username: String(row.username) };
}
export async function readAppSession(request: Request, db: Database = getMessengerPool()): Promise<AppSession> {
  try {
    const protection = await readProtection(db);
    const identity = await readIdentity(request, db);
    return { protectionEnabled: protection.protectionEnabled, revision: protection.revision, updatedAt: protection.updatedAt,
      authenticated: !!identity, role: identity?.role || null, username: identity?.username || '',
      canUse: !!identity && (identity.role === 'admin' || !protection.protectionEnabled),
      updatedBy: identity?.role === 'admin' ? protection.updatedBy : '' };
  } catch { throw new AppSecurityError('Chưa đọc được phiên hoặc cấu hình bảo vệ. Vui lòng thử lại.', 503, 'SECURITY_UNAVAILABLE'); }
}
export async function loginApp(request: Request, username: string, password: string, db: Database = getMessengerPool()) {
  sameOrigin(request);
  if (!username || username.length > 254 || !password || password.length > 1024) {
    throw new AppSecurityError('Tài khoản hoặc mật khẩu không hợp lệ.', 400, 'INVALID_LOGIN');
  }
  const admin = account('admin');
  if (admin.username === 'admin') throw new AppSecurityError('Tài khoản quản trị phải khác tài khoản demo.', 503, 'INVALID_ADMIN_CONFIG');
  const bucket = username === admin.username ? 'admin' : username === 'admin' ? 'user' : 'unknown';
  const now = Date.now();
  const attempt = (await db.query(`INSERT INTO app_login_attempts(bucket,attempts,reset_at) VALUES($1,1,$2)
    ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN app_login_attempts.reset_at<=$3 THEN 1 ELSE app_login_attempts.attempts+1 END,
    reset_at=CASE WHEN app_login_attempts.reset_at<=$3 THEN $2 ELSE app_login_attempts.reset_at END RETURNING attempts`, [bucket, now + 60000, now])).rows[0];
  if (Number(attempt.attempts) > 10) throw new AppSecurityError('Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau một phút.', 429, 'LOGIN_LIMIT');
  let role: 'admin' | 'user';
  if (username === admin.username && await verifyPassword(password, admin.password)) role = 'admin';
  else if (username === 'admin' && timingSafeEqual(Buffer.from(hash(password)), Buffer.from(hash('admin123')))) role = 'user';
  else throw new AppSecurityError('Tài khoản hoặc mật khẩu chưa đúng.', 401, 'INVALID_LOGIN');
  await readProtection(db);
  const token = randomBytes(32).toString('hex');
  await db.query('DELETE FROM app_sessions WHERE expires_at<=$1 OR token_hash=$2', [now, hash(requestToken(request))]);
  await db.query('INSERT INTO app_sessions(token_hash,role,username,credential_hash,expires_at) VALUES($1,$2,$3,$4,$5)',
    [hash(token), role, username, credentialHash(role), now + SESSION_SECONDS * 1000]);
  await db.query('DELETE FROM app_login_attempts WHERE bucket=$1', [bucket]);
  return { token, role };
}
export async function logoutApp(request: Request, db: Database = getMessengerPool()) {
  sameOrigin(request);
  await db.query('DELETE FROM app_sessions WHERE token_hash=$1', [hash(requestToken(request))]);
}
export async function changeProtection(request: Request, enabled: boolean, revision: number, db: Database = getMessengerPool()) {
  sameOrigin(request);
  const identity = await readIdentity(request, db);
  if (identity?.role !== 'admin') throw new AppSecurityError('Chỉ quản trị viên được thay đổi chế độ bảo vệ.', 403, 'ADMIN_REQUIRED');
  const now = Date.now();
  const result = await db.query(`UPDATE app_security_settings SET protection_enabled=$1,revision=revision+1,
    updated_at=$2,updated_by=$3,automatic_after=$2 WHERE id=1 AND revision=$4 RETURNING id`, [enabled, now, identity.username, revision]);
  if (!result.rowCount) throw new AppSecurityError('Trạng thái đã thay đổi. Hãy tải lại trước khi thao tác.', 409, 'STALE_SECURITY');
  return readAppSession(request, db);
}
export async function requireAppAccess(request: Request, db: Database = getMessengerPool()) {
  if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request);
  if (!requestToken(request)) throw new AppSecurityError('Vui lòng đăng nhập để sử dụng chức năng.', 401, 'LOGIN_REQUIRED');
  const session = await readAppSession(request, db);
  if (!session.authenticated) throw new AppSecurityError('Vui lòng đăng nhập để sử dụng chức năng.', 401, 'LOGIN_REQUIRED');
  if (!session.canUse) throw new AppSecurityError('App đang được bảo vệ. Bạn đang ở chế độ chỉ xem.', 403);
  return session;
}
export function withAppAccess<Args extends unknown[]>(handler: (request: Request, ...args: Args) => Response | Promise<Response>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      await requireAppAccess(request);
      const response = await actors.run({ request }, () => handler(request, ...args));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      if (error instanceof AppSecurityError) return securityErrorResponse(error);
      return Response.json({ error: 'Không kiểm tra hoặc xử lý được quyền truy cập. Vui lòng thử lại.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
export function legacyAccessError(request: Request) {
  const actor = actors.getStore();
  return actor && 'request' in actor && actor.request === request ? undefined
    : Response.json({ error: 'Vui lòng đăng nhập.', code: 'LOGIN_REQUIRED' }, { status: 401 });
}
export function isInteractiveRequest() { return !!actors.getStore() && 'request' in actors.getStore()!; }
export async function canRunAutomation(db: Database = getMessengerPool()) {
  try { return !(await readProtection(db)).protectionEnabled; } catch { return false; }
}
export function runAutomaticAccess<T>(automaticAt: number, operation: () => Promise<T>) {
  return actors.run({ automaticAt }, operation);
}
export async function assertOperationAllowed(db: Database = getMessengerPool()) {
  const actor = actors.getStore();
  if (!actor) throw new AppSecurityError('Thiếu phiên được cấp quyền.', 401, 'LOGIN_REQUIRED');
  if ('request' in actor) { await requireAppAccess(actor.request, db); return; }
  const state = await readProtection(db);
  if (state.protectionEnabled || !Number.isFinite(actor.automaticAt) || actor.automaticAt <= state.automaticAfter) {
    throw new AppSecurityError('Tự động gửi đang tạm dừng hoặc tin thuộc hàng chờ cần duyệt.');
  }
}
