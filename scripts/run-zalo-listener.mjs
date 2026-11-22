// Đồng bộ tin nhắn Zalo CÁ NHÂN về Tendly bằng zca-js (API không chính thức, mô phỏng Zalo Web; có thể bị khóa tài khoản).
// Chỉ dùng tài khoản thử nghiệm. Chạy: npm run zalo:listener (lần đầu quét QR, các lần sau dùng lại phiên đã lưu).
import { setTimeout } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Zalo, ThreadType } from 'zca-js';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const base = new URL(process.env.TENDLY_APP_URL || 'http://localhost:3000');
const secret = process.env.ZALO_INGEST_SECRET?.trim();
if (!secret) throw new Error('Configure ZALO_INGEST_SECRET (cùng giá trị ở app và worker) trước khi chạy.');
if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('TENDLY_APP_URL must use HTTPS or localhost.');
const sessionFile = process.env.ZALO_SESSION_FILE || '.zalo-session.json';

// selfListen: tin shop tự nhắn từ điện thoại cũng được đồng bộ (hiện là tin "out").
const zalo = new Zalo({ selfListen: true });
let api;
if (existsSync(sessionFile)) {
  try { api = await zalo.login(JSON.parse(readFileSync(sessionFile, 'utf8'))); console.log('Đã đăng nhập Zalo bằng phiên đã lưu.'); }
  catch { console.error('Phiên Zalo đã lưu không còn dùng được, cần quét QR lại.'); }
}
if (!api) {
  // Không truyền callback: có callback thì zca-js không tự lưu ảnh QR. Mã hết hạn thì loginQR báo lỗi, chạy lại lệnh.
  console.log('Mở file zalo-qr.png (sắp được tạo) và quét bằng app Zalo của tài khoản thử nghiệm.');
  api = await zalo.loginQR({ qrPath: './zalo-qr.png' });
  const ctx = api.getContext();
  // File này cho phép điều khiển tài khoản Zalo: đã nằm trong .gitignore, không chia sẻ.
  writeFileSync(sessionFile, JSON.stringify({ imei: ctx.imei, userAgent: ctx.userAgent, cookie: ctx.cookie.toJSON()?.cookies ?? [] }), { mode: 0o600 });
}
const ownId = api.getOwnId();
console.log(`Zalo đã kết nối, tài khoản ${ownId}.`);

const profiles = new Map(); // uid -> { name, avatar }; hỏi Zalo một lần cho mỗi khách
async function profileOf(uid, fallbackName) {
  if (!profiles.has(uid)) {
    try {
      const changed = (await api.getUserInfo(uid)).changed_profiles ?? {};
      const info = changed[uid] ?? changed[`${uid}_0`]; // zca-js hỏi theo "uid_0", khóa trả về có thể là một trong hai
      if (info?.displayName || info?.zaloName) profiles.set(uid, { name: info.displayName || info.zaloName, avatar: info.avatar || null });
    } catch { /* thiếu hồ sơ không được chặn đồng bộ tin; thử lại ở tin sau */ }
  }
  // dName có sẵn trong mỗi tin của khách; không cache khi chưa có hồ sơ thật để lần sau còn thử lại.
  return profiles.get(uid) ?? (fallbackName ? { name: fallbackName, avatar: null } : null);
}

/** Chỉ chat 1-1; nhóm bỏ qua. Tin không phải chữ gửi kèm loại + link để hiện "[Tệp đính kèm]". */
async function normalize(m) {
  // Bỏ nhóm và luồng "Cloud của tôi" (threadId = chính mình): một tin sai làm server từ chối cả lô.
  if (m.type !== ThreadType.User || m.threadId === ownId) return null;
  const content = m.data.content;
  const text = typeof content === 'string' ? content : '';
  const attachments = typeof content === 'string' ? [] : [{
    type: String(m.data.msgType || '').includes('photo') ? 'image' : 'file',
    url: typeof content?.href === 'string' ? content.href : undefined,
  }];
  return { threadId: m.threadId, isSelf: m.isSelf, msgId: String(m.data.msgId), ts: Number(m.data.ts), text, attachments,
    profile: m.isSelf ? undefined : await profileOf(m.threadId, m.data.dName) ?? undefined };
}

async function push(batch) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(new URL('/api/zalo/ingest', base), { method: 'POST', signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ownId, messages: batch }) });
      if (response.ok) return console.log(`Đã đồng bộ ${batch.length} tin Zalo.`);
      if (response.status < 500) return console.error(`Tendly từ chối tin Zalo (${response.status}): ${(await response.json().catch(() => ({}))).error ?? ''}`);
    } catch { /* app tạm không với tới: thử lại */ }
    await setTimeout(attempt * 2000);
  }
  console.error('Không đẩy được tin Zalo về Tendly sau 5 lần; bỏ qua lô này.');
}

// Một hàng đợi nối tiếp giữ đúng thứ tự tin và không đẩy chồng.
let queue = Promise.resolve();
const enqueue = (messages) => { queue = queue.then(async () => {
  const batch = [];
  for (const message of messages) { const item = await normalize(message); if (item) batch.push(item); } // tuần tự: không dồn dập hỏi hồ sơ Zalo
  for (let i = 0; i < batch.length; i += 100) await push(batch.slice(i, i + 100));
}).catch((error) => console.error('Lỗi xử lý tin Zalo:', error instanceof Error ? error.message : error)); };

api.listener.on('message', (message) => enqueue([message]));
api.listener.on('old_messages', (messages, type) => { if (type === ThreadType.User) enqueue(messages); });
// Mỗi lần (kết nối lại) xin lô tin gần nhất để bù tin lúc worker tắt; lưu trùng bị bỏ qua nhờ khóa msgId.
api.listener.on('connected', () => { console.log('Đang nghe tin Zalo.'); api.listener.requestOldMessages(ThreadType.User); });
api.listener.on('error', (error) => console.error('Zalo listener lỗi:', error instanceof Error ? error.message : error));
api.listener.on('closed', (code, reason) => {
  console.error(`Zalo đóng kết nối (${code} ${reason}). Nếu mã 3000 là có nơi khác đang mở Zalo Web cùng tài khoản.`);
  process.exit(1);
});
api.listener.start({ retryOnClose: true });
