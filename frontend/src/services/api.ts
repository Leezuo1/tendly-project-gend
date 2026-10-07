/**
 * Mock API — mọi hàm đều async + có độ trễ giả lập như gọi mạng thật.
 * Khi làm backend: giữ nguyên chữ ký hàm, thay phần thân bằng fetch(...).
 */
import { readDb, resetDb, writeDb } from '../mocks/db';
import { PLANS, SHOPEE_NEW_PRODUCT } from '../mocks/seed';
import type {
  Channel, ChannelId, EmailLog, EmailTrigger, Faq, Member, MemberRole, Plan, Product,
  ProductSource, Shop, Subscription, TriggerKind,
} from '../types';
import { isEmail, normalize, uid } from '../utils/format';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => structuredClone(v);

async function respond<T>(value: T, ms = 300): Promise<T> {
  await sleep(ms + Math.random() * 150);
  return clone(value);
}

export class ApiError extends Error {}

/* ---------------- Shop & gói cước ---------------- */

export const shopApi = {
  get: () => respond<Shop>(readDb().shop, 150),

  async update(patch: Partial<Shop>): Promise<Shop> {
    if (patch.name !== undefined && !patch.name.trim()) throw new ApiError('Tên shop không được để trống');
    if (patch.email !== undefined && !isEmail(patch.email)) throw new ApiError('Email liên hệ không hợp lệ');
    const db = writeDb((d) => { d.shop = { ...d.shop, ...patch }; });
    return respond(db.shop, 500);
  },
};

export const billingApi = {
  getPlans: () => respond<Plan[]>(PLANS, 100),
  getSubscription: () => respond<Subscription>(readDb().subscription),

  async changePlan(planId: string): Promise<Subscription> {
    if (!PLANS.some((p) => p.id === planId)) throw new ApiError('Gói cước không tồn tại');
    const db = writeDb((d) => { d.subscription.planId = planId; });
    return respond(db.subscription, 700);
  },
};

/* ---------------- Nhân viên ---------------- */

export const memberApi = {
  list: () => respond<Member[]>(readDb().members),

  async invite(email: string, role: MemberRole): Promise<Member> {
    const clean = email.trim().toLowerCase();
    if (!isEmail(clean)) throw new ApiError('Email không hợp lệ');
    if (readDb().members.some((m) => m.email.toLowerCase() === clean)) {
      throw new ApiError('Email này đã có trong danh sách nhân viên');
    }
    const name = clean.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const member: Member = { id: uid('m'), name, email: clean, role, status: 'pending' };
    writeDb((d) => { d.members.push(member); });
    return respond(member, 600);
  },

  async updateRole(id: string, role: MemberRole): Promise<Member> {
    const db = readDb();
    const target = db.members.find((m) => m.id === id);
    if (!target) throw new ApiError('Không tìm thấy nhân viên');
    if (target.role === 'owner' && role !== 'owner' && db.members.filter((m) => m.role === 'owner').length === 1) {
      throw new ApiError('Shop cần ít nhất 1 chủ shop');
    }
    writeDb(() => { target.role = role; });
    return respond(target);
  },

  async remove(id: string): Promise<void> {
    const db = readDb();
    const target = db.members.find((m) => m.id === id);
    if (target?.role === 'owner' && db.members.filter((m) => m.role === 'owner').length === 1) {
      throw new ApiError('Không thể xoá chủ shop duy nhất');
    }
    writeDb((d) => { d.members = d.members.filter((m) => m.id !== id); });
    await sleep(400);
  },

  async resendInvite(id: string): Promise<void> {
    if (!readDb().members.some((m) => m.id === id)) throw new ApiError('Không tìm thấy nhân viên');
    await sleep(600);
  },
};

/* ---------------- Kênh kết nối ---------------- */

export const channelApi = {
  list: () => respond<Channel[]>(readDb().channels),

  async setEnabled(id: ChannelId, enabled: boolean): Promise<Channel> {
    let result: Channel | undefined;
    writeDb((d) => {
      result = d.channels.find((c) => c.id === id);
      if (result) result.enabled = enabled;
    });
    if (!result) throw new ApiError('Kênh không tồn tại');
    return respond(result, 250);
  },

  async connect(id: ChannelId): Promise<Channel> {
    let result: Channel | undefined;
    writeDb((d) => {
      result = d.channels.find((c) => c.id === id);
      if (result) {
        if (result.comingSoon) throw new ApiError('Kênh này sắp ra mắt');
        result.connected = true;
        result.enabled = true;
        result.account = id === 'zalo' ? 'Zalo OA Tendly Official' : `${result.name} Tendly`;
      }
    });
    if (!result) throw new ApiError('Kênh không tồn tại');
    return respond(result, 1400);
  },

  async disconnect(id: ChannelId): Promise<Channel> {
    let result: Channel | undefined;
    writeDb((d) => {
      result = d.channels.find((c) => c.id === id);
      if (result) Object.assign(result, { connected: false, enabled: false, account: null });
    });
    if (!result) throw new ApiError('Kênh không tồn tại');
    return respond(result, 500);
  },
};

/* ---------------- Sản phẩm ---------------- */

export const productApi = {
  list: () => respond<Product[]>(readDb().products),
  getSource: () => respond<ProductSource>(readDb().productSource, 100),

  /** Giả lập đồng bộ Shopee: tồn kho thay đổi nhẹ, lần đầu có thêm 1 sản phẩm mới */
  async syncShopee(): Promise<{ products: Product[]; source: ProductSource; changed: number; added: number }> {
    await sleep(1600);
    let changed = 0;
    let added = 0;
    const db = writeDb((d) => {
      d.products.forEach((p) => {
        if (Math.random() < 0.35) {
          const delta = Math.round((Math.random() - 0.6) * 12);
          if (delta !== 0) {
            p.qty = Math.max(0, p.qty + delta);
            changed++;
          }
        }
      });
      if (!d.products.some((p) => p.sku === SHOPEE_NEW_PRODUCT.sku)) {
        d.products.unshift(clone(SHOPEE_NEW_PRODUCT));
        added = 1;
      }
      d.productSource.lastSyncedAt = Date.now();
      d.productSource.syncCount += 1;
    });
    return { products: clone(db.products), source: clone(db.productSource), changed, added };
  },

  /** Thêm mới hoặc cập nhật theo SKU */
  async importMany(rows: Omit<Product, 'id'>[]): Promise<{ products: Product[]; added: number; updated: number }> {
    if (rows.length === 0) throw new ApiError('File không có dòng dữ liệu hợp lệ');
    let added = 0;
    let updated = 0;
    const db = writeDb((d) => {
      rows.forEach((row) => {
        const existing = d.products.find((p) => p.sku.toLowerCase() === row.sku.toLowerCase());
        if (existing) {
          Object.assign(existing, row, { id: existing.id });
          updated++;
        } else {
          d.products.push({ ...row, id: uid('p') });
          added++;
        }
      });
    });
    return respond({ products: db.products, added, updated }, 900);
  },
};

/* ---------------- FAQ ---------------- */

export type FaqInput = Omit<Faq, 'id'>;

function validateFaq(input: FaqInput, ignoreId?: string) {
  if (!input.question.trim()) throw new ApiError('Vui lòng nhập câu hỏi');
  if (!input.answer.trim()) throw new ApiError('Vui lòng nhập câu trả lời');
  const dup = readDb().faqs.find((f) => f.id !== ignoreId && normalize(f.question) === normalize(input.question));
  if (dup) throw new ApiError('Câu hỏi này đã tồn tại');
}

export const faqApi = {
  list: () => respond<Faq[]>(readDb().faqs),

  async create(input: FaqInput): Promise<Faq> {
    validateFaq(input);
    const faq: Faq = { ...input, id: uid('f') };
    writeDb((d) => { d.faqs.unshift(faq); });
    return respond(faq, 450);
  },

  async update(id: string, input: FaqInput): Promise<Faq> {
    validateFaq(input, id);
    let result: Faq | undefined;
    writeDb((d) => {
      result = d.faqs.find((f) => f.id === id);
      if (result) Object.assign(result, input);
    });
    if (!result) throw new ApiError('Không tìm thấy câu hỏi');
    return respond(result, 450);
  },

  async remove(id: string): Promise<void> {
    writeDb((d) => { d.faqs = d.faqs.filter((f) => f.id !== id); });
    await sleep(350);
  },
};

/* ---------------- Email tự động ---------------- */

export const emailApi = {
  listTriggers: () => respond<EmailTrigger[]>(readDb().triggers),
  listLogs: () => respond<EmailLog[]>([...readDb().emailLogs].sort((a, b) => b.sentAt - a.sentAt)),

  async updateTrigger(id: TriggerKind, patch: Partial<EmailTrigger>): Promise<EmailTrigger> {
    if (patch.subject !== undefined && !patch.subject.trim()) throw new ApiError('Tiêu đề email không được để trống');
    if (patch.delayValue !== undefined && (!Number.isFinite(patch.delayValue) || patch.delayValue < 1)) {
      throw new ApiError('Thời gian chờ phải lớn hơn 0');
    }
    let result: EmailTrigger | undefined;
    writeDb((d) => {
      result = d.triggers.find((t) => t.id === id);
      if (result) Object.assign(result, patch);
    });
    if (!result) throw new ApiError('Không tìm thấy kịch bản');
    return respond(result, 300);
  },

  /** Ghi log 1 email đã gửi (dùng cho "Gửi thử" và khi khung chat phát hiện khách bực) */
  async logSent(triggerId: TriggerKind, customer: string, summary: string): Promise<EmailLog> {
    const log: EmailLog = { id: uid('l'), customer, triggerId, summary, sentAt: Date.now(), status: 'sent' };
    writeDb((d) => { d.emailLogs.unshift(log); d.emailLogs = d.emailLogs.slice(0, 30); });
    return respond(log, 500);
  },

  isTriggerEnabled: (id: TriggerKind) => readDb().triggers.find((t) => t.id === id)?.enabled ?? false,
};

/* ---------------- Tiện ích ---------------- */

/** Đọc đồng bộ — dùng cho bot trong khung chat (không cần chờ mạng giả) */
export const snapshot = {
  faqs: () => clone(readDb().faqs),
  products: () => clone(readDb().products),
  trigger: (id: TriggerKind) => clone(readDb().triggers.find((t) => t.id === id)!),
  shop: () => clone(readDb().shop),
};

export function resetMockData() {
  resetDb();
}
