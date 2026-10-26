import { createHmac } from 'node:crypto';
import type { Product } from '@/lib/types/admin';

export class ShopeeError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function shopeeConfig() {
  const partnerId = process.env.SHOPEE_PARTNER_ID?.trim() || '';
  const partnerKey = process.env.SHOPEE_PARTNER_KEY?.trim() || '';
  const shopId = process.env.SHOPEE_SHOP_ID?.trim() || '';
  const environment = process.env.SHOPEE_SANDBOX?.trim() || 'false';
  if (!['true', 'false'].includes(environment)) throw new ShopeeError('SHOPEE_SANDBOX phải là true hoặc false.', 503);
  const sandbox = environment === 'true';
  if (![partnerId, shopId].every((id) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) || !partnerKey) {
    throw new ShopeeError('Chưa cấu hình SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY và SHOPEE_SHOP_ID hợp lệ.', 503);
  }
  if (!process.env.DATABASE_URL?.trim()) throw new ShopeeError('Chưa cấu hình DATABASE_URL.', 503);
  return { partnerId, partnerKey, shopId, sandbox,
    host: sandbox ? 'https://openplatform.sandbox.test-stable.shopee.sg' : 'https://partner.shopeemobile.com' };
}

type Config = ReturnType<typeof shopeeConfig>;
export const shopeeSign = (config: Config, path: string, timestamp: number, token = '') =>
  createHmac('sha256', config.partnerKey)
    .update(`${config.partnerId}${path}${timestamp}${token}${token ? config.shopId : ''}`).digest('hex');

export function shopeeRedirect() {
  let url: URL;
  try { url = new URL(process.env.SHOPEE_REDIRECT_URL || ''); }
  catch { throw new ShopeeError('Chưa cấu hình SHOPEE_REDIRECT_URL hợp lệ.', 503); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password ||
      url.pathname !== '/api/shopee/callback' || url.search || url.hash) {
    throw new ShopeeError('SHOPEE_REDIRECT_URL phải là URL HTTPS /api/shopee/callback (local được dùng HTTP).', 503);
  }
  return url;
}

export function shopeeAuthUrl(config: Config, state: string) {
  const url = new URL('/auth', config.sandbox ? 'https://open.sandbox.test-stable.shopee.com' : 'https://open.shopee.com');
  url.search = new URLSearchParams({ partner_id: config.partnerId, auth_type: 'seller',
    redirect_uri: shopeeRedirect().href, response_type: 'code', state }).toString();
  return url.href;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShopeeError('Shopee trả dữ liệu không hợp lệ; danh mục cũ được giữ nguyên.');
  }
  return value as Record<string, unknown>;
}
function list(value: unknown) {
  if (!Array.isArray(value)) throw new ShopeeError('Shopee trả danh sách không đầy đủ; hãy thử đồng bộ lại.');
  return value.map(object);
}
function id(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ShopeeError('Shopee trả mã sản phẩm không hợp lệ.');
  }
  return String(value);
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ShopeeError('Shopee chưa cung cấp đủ giá hoặc tồn kho; danh mục cũ được giữ nguyên.');
  }
  return value;
}
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function shopeeRequest(config: Config, path: string, options: {
  token?: string; params?: Record<string, string>; body?: Record<string, unknown>; signal?: AbortSignal;
} = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(path, config.host);
  url.search = new URLSearchParams({ partner_id: config.partnerId, timestamp: String(timestamp),
    sign: shopeeSign(config, path, timestamp, options.token), ...options.params,
    ...(options.token ? { access_token: options.token, shop_id: config.shopId } : {}) }).toString();
  let response: Response;
  let data: Record<string, unknown>;
  try {
    response = await fetch(url, { method: options.body ? 'POST' : 'GET', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    data = object(await response.json());
  } catch {
    throw new ShopeeError('Không nhận được phản hồi hợp lệ từ Shopee. Hãy thử lại; nếu đang cấp quyền, hãy kết nối lại.');
  }
  if (!response.ok || data.error) {
    const auth = /auth|token|permission/i.test(String(data.error));
    throw new ShopeeError(auth ? 'Shopee từ chối quyền truy cập. Kiểm tra quyền API hoặc kết nối lại shop.'
      : 'Shopee từ chối yêu cầu. Kiểm tra cấu hình ứng dụng, quyền API và giới hạn truy cập.');
  }
  return data;
}

export async function shopeeTokens(config: Config, credential: { code: string } | { refresh_token: string }) {
  const path = 'code' in credential ? '/api/v2/auth/token/get' : '/api/v2/auth/access_token/get';
  const data = await shopeeRequest(config, path, { body: {
    ...credential, partner_id: Number(config.partnerId), shop_id: Number(config.shopId),
  } });
  if (typeof data.access_token !== 'string' || !data.access_token || typeof data.refresh_token !== 'string' ||
      !data.refresh_token || (data.shop_id !== undefined && String(data.shop_id) !== config.shopId)) {
    throw new ShopeeError('Shopee trả thông tin cấp quyền không hợp lệ. Hãy kết nối lại.');
  }
  const expires = number(data.expire_in);
  if (expires < 60) throw new ShopeeError('Token Shopee đã hết hạn. Hãy kết nối lại.');
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + expires * 1000 };
}

function product(config: Config, item: Record<string, unknown>, model?: Record<string, unknown>, tiers: Record<string, unknown>[] = []): Product {
  const value = model || item;
  const itemId = id(item.item_id);
  const modelId = model ? id(model.model_id) : '0';
  const price = list(value.price_info)[0];
  if (!price || price.currency !== 'VND') throw new ShopeeError('Bản demo chỉ hỗ trợ giá VND của shop Shopee Việt Nam.');
  const stock = object(object(value.stock_info_v2).summary_info);
  const qty = number(stock.total_available_stock);
  if (!Number.isSafeInteger(qty)) throw new ShopeeError('Tồn kho Shopee không hợp lệ.');
  const colors: string[] = [];
  const sizes: string[] = [];
  const labels: string[] = [];
  if (model) {
    if (!Array.isArray(model.tier_index) || model.tier_index.length !== tiers.length) {
      throw new ShopeeError('Phân loại Shopee không đầy đủ. Hãy thử đồng bộ lại.');
    }
    tiers.forEach((tier, index) => {
      const optionIndex = model.tier_index as unknown[];
      const n = number(optionIndex[index]);
      const option = list(tier.option_list)[n];
      const label = option && text(option.option, 200);
      if (!Number.isInteger(n) || !label) throw new ShopeeError('Phân loại Shopee không hợp lệ.');
      labels.push(`${text(tier.name, 80)}: ${label}`);
      if (/màu|color|colour/i.test(text(tier.name))) colors.push(label);
      if (/size|kích|cỡ/i.test(text(tier.name))) sizes.push(label);
    });
  }
  const name = text(item.item_name, 300);
  if (!name) throw new ShopeeError('Sản phẩm Shopee thiếu tên.');
  return { id: `shopee:${config.shopId}:${itemId}:${modelId}`,
    sku: text(model?.model_sku || item.item_sku, 200) || `${itemId}-${modelId}`,
    name: `${name}${labels.length ? ` (${labels.join(', ')})` : ''}`.slice(0, 500),
    material: '', emoji: '🛍️', category: 'Shopee', colors, sizes, qty, price: number(price.current_price) };
}

export async function shopeeCatalog(config: Config, token: string) {
  const signal = AbortSignal.timeout(110000);
  const call = async (path: string, params?: Record<string, string>) =>
    object((await shopeeRequest(config, path, { token, params, signal })).response);
  const products: Product[] = [];
  const seen = new Set<string>();
  let offset = 0;
  // shortcut: tối đa 500 dòng để khớp giới hạn nguồn AI, nâng cấp phân trang AI khi shop lớn hơn.
  for (;;) {
    const page = await call('/api/v2/product/get_item_list', { offset: String(offset), page_size: '50', item_status: 'NORMAL' });
    const items = list(page.item);
    const ids = items.map((item) => id(item.item_id));
    if (ids.some((value) => seen.has(value)) || new Set(ids).size !== ids.length) throw new ShopeeError('Shopee trả trang sản phẩm trùng; hãy thử lại.');
    ids.forEach((value) => seen.add(value));
    if (ids.length) {
      const details = list((await call('/api/v2/product/get_item_base_info', { item_id_list: ids.join(',') })).item_list);
      const returned = new Set(details.map((item) => id(item.item_id)));
      if (returned.size !== ids.length || details.length !== ids.length || ids.some((value) => !returned.has(value))) {
        throw new ShopeeError('Shopee trả thiếu sản phẩm; danh mục cũ được giữ nguyên. Hãy thử lại.');
      }
      for (const item of details) {
        if (item.item_status !== 'NORMAL') continue;
        if (typeof item.has_model !== 'boolean') throw new ShopeeError('Shopee trả thiếu thông tin phân loại.');
        if (item.has_model) {
          const data = await call('/api/v2/product/get_model_list', { item_id: id(item.item_id) });
          const models = list(data.model);
          if (!models.length) throw new ShopeeError('Shopee trả thiếu phân loại; hãy thử lại.');
          for (const model of models) {
            if (model.model_status === 'MODEL_UNAVAILABLE') continue;
            if (model.model_status !== 'MODEL_NORMAL') throw new ShopeeError('Trạng thái phân loại Shopee không hợp lệ.');
            products.push(product(config, item, model, list(data.tier_variation)));
          }
        } else products.push(product(config, item));
        if (products.length > 500) throw new ShopeeError('Bản demo hỗ trợ tối đa 500 dòng sản phẩm và phân loại.', 422);
      }
    }
    if (page.has_next_page === false) break;
    if (page.has_next_page !== true || !items.length || typeof page.next_offset !== 'number' ||
        !Number.isSafeInteger(page.next_offset) || page.next_offset <= offset) throw new ShopeeError('Phân trang Shopee không hợp lệ.');
    offset = page.next_offset;
  }
  if (new Set(products.map((p) => p.id)).size !== products.length) throw new ShopeeError('Shopee trả phân loại trùng.');
  const info = await shopeeRequest(config, '/api/v2/shop/get_shop_info', { token, signal });
  if (info.region !== 'VN') throw new ShopeeError('Bản demo chỉ hỗ trợ shop Shopee Việt Nam.');
  return { products, name: text(info.shop_name) || `Shopee ${config.shopId}` };
}

export function shopeeErrorResponse(error: unknown) {
  if (error instanceof ShopeeError) return Response.json({ error: error.message }, { status: error.status });
  const missingTable = (error as { code?: string })?.code === '42P01';
  return Response.json({ error: missingTable ? 'Chưa có bảng Shopee. Chạy npm run db:migrate rồi thử lại.'
    : 'Không truy cập được dữ liệu Shopee. Kiểm tra database rồi thử lại.' }, { status: 503 });
}
