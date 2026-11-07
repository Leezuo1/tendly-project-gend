import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { AppSecurityError, requireAppAccess } from '@/lib/services/appSecurity';
import { AI_ROLES, GLOBAL_AI_FIELDS, ROLE_PLATFORMS, defaultAiConfiguration, effectiveAiRules, parseAiConfiguration,
  type AiPlatform, type AiProfile, type AiRoleId,
  type GlobalAiBasics, type GlobalAiConfiguration, type GlobalAiField, type GlobalAiProfile } from '@/lib/services/aiConfiguration';

const KEYS = Object.keys(GLOBAL_AI_FIELDS) as GlobalAiField[];
const MAX = 2000;

/** Lớp TikTok mặc định của AI Smart Sourcing: khám phá sản phẩm từ video. */
export const SOURCING_TIKTOK_DEFAULT: Partial<GlobalAiBasics> = {
  description: 'Phân tích xu hướng sản phẩm từ video TikTok 7 ngày gần nhất, bóc tách sản phẩm/ngách sản phẩm đang có nhu cầu mua thực tế cao.',
  domain: 'Thương mại điện tử, Social Commerce trên TikTok',
  role: 'Bạn là Chuyên gia Phân tích Xu hướng Sản phẩm Thương mại Điện tử (E-commerce Product Trend Analyst) của hệ thống Tendly Smart Sourcing. Nhiệm vụ của bạn là đọc dữ liệu thô thu thập từ các video TikTok trong 7 ngày gần nhất và bóc tách ra các sản phẩm/ngách sản phẩm tiềm năng đang có nhu cầu mua thực tế cao.',
  rules: `1. Lọc nhiễu giải trí: loại bỏ các video chỉ mang tính chất hài hước, tin tức, drama hoặc giải trí đơn thuần không xoay quanh một sản phẩm vật lý có thể kinh doanh.
2. Chỉ dựa trên dữ liệu thật (Zero Hallucination): mọi kết luận về đặc điểm sản phẩm, nỗi đau khách hàng và góc làm nội dung PHẢI được suy ra trực tiếp từ danh sách bài viết thu thập được. Tuyệt đối không tự bịa ra thông số hoặc xu hướng bên ngoài dữ liệu đầu vào.
3. Phân biệt view ảo và nhu cầu thật: đánh giá cao các sản phẩm có bình luận hỏi giá, hỏi chỗ mua, hỏi size, khen kiểu dáng hơn là các video chỉ có lượt xem cao nhưng bình luận không liên quan đến sản phẩm.
4. Không lan man sang nguồn hàng: chỉ tập trung hoàn toàn vào việc giải phẫu sản phẩm, tâm lý người mua và cách làm nội dung bán hàng trên TikTok.
5. Ngôn ngữ: tiếng Việt chuyên ngành E-commerce/Social Commerce, ngắn gọn, súc tích, đi thẳng vào insight giúp chủ shop ra quyết định kinh doanh.`,
};

/** Lớp Google mặc định của AI Smart Sourcing: thẩm định nhà cung cấp từ trang web tìm thấy trên Google. */
export const SOURCING_GOOGLE_DEFAULT: Partial<GlobalAiBasics> = {
  description: 'Thẩm định nguồn hàng B2B: tìm nhà cung cấp, xưởng sản xuất, tổng kho sỉ thực sự phù hợp từ các trang web tìm thấy trên Google.',
  domain: 'Thu mua B2B, nguồn hàng sỉ cho shop bán online tại Việt Nam',
  role: 'Bạn là Chuyên gia Thẩm định Nguồn hàng và Thu mua B2B (B2B Sourcing & Procurement Specialist) của hệ thống Tendly Smart Sourcing. Nhiệm vụ của bạn là phân tích nội dung từ các trang web tìm thấy trên Google để tìm ra các nhà cung cấp, xưởng sản xuất, hoặc tổng kho sỉ thực sự phù hợp với nhu cầu của chủ shop.',
  rules: `1. Lọc rác SEO & trung gian ẩn danh: loại bỏ các bài viết dạng "Top 10 nguồn hàng...", các bài blog chia sẻ kinh nghiệm chung chung, hoặc các trang sản phẩm bán lẻ cho người tiêu dùng cuối (B2C) không đề cập đến bán sỉ. Nếu một bài viết là bài tổng hợp nhưng bên trong có nhắc đến tên và thông tin cụ thể của một xưởng/nhà cung cấp uy tín, hãy bóc tách thông tin của xưởng đó và ghi rõ nguồn trích xuất.
2. Chỉ dựa trên dữ liệu thật (Zero Hallucination): chỉ trích xuất số điện thoại, Zalo, địa chỉ, chính sách MOQ (số lượng tối thiểu) và giá cả NẾU chúng xuất hiện rõ ràng trong văn bản thu thập được. Nếu trang web không ghi giá hoặc điều kiện sỉ, ghi rõ là "Không công khai trên web - Cần liên hệ trực tiếp" và đưa điểm này vào danh sách cần xác minh. Tuyệt đối không tự bịa ra số điện thoại hay giá sỉ.
3. Phân biệt xưởng gốc và kho buôn: dựa vào từ vựng và dịch vụ trên web (có nhận may gia công/OEM, có địa chỉ nhà xưởng -> xưởng sản xuất; bán đa dạng tạp nham nhiều ngành hàng -> tổng kho/trung gian) để phân loại chính xác cho người dùng.
4. Ngôn ngữ: tiếng Việt thực tế, sắc bén, đứng về phía quyền lợi của người đi nhập hàng.`,
};

export function defaultGlobalAiConfiguration(): GlobalAiConfiguration {
  return { version: 2, profiles: Object.fromEntries(AI_ROLES.map(role => [role.id, {
    base: { description: role.description, domain: 'Thương mại điện tử, bán hàng online', role: role.goal, rules: role.guard, forbidden: '' },
    platforms: role.id === 'sourcing' ? { tiktok: { ...SOURCING_TIKTOK_DEFAULT }, google: { ...SOURCING_GOOGLE_DEFAULT } } : {},
  }])) as GlobalAiConfiguration['profiles'] };
}

export function parseGlobalAiConfiguration(value: unknown): GlobalAiConfiguration {
  const object = (v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Cấu hình AI chung không hợp lệ.');
    return v as Record<string, unknown>;
  };
  const fields = (v: unknown, partial: boolean) => {
    const data = object(v), result: Partial<GlobalAiBasics> = {};
    if (Object.keys(data).some(key => !(key in GLOBAL_AI_FIELDS))) throw new Error('Trường cấu hình AI chung không hợp lệ.');
    for (const key of KEYS) {
      if (partial && !(key in data)) continue;
      const text = data[key];
      if (typeof text !== 'string' || text.length > MAX) throw new Error(`${GLOBAL_AI_FIELDS[key]}: tối đa ${MAX} ký tự.`);
      if (!partial || text.trim()) result[key] = text.trim();
    }
    return result;
  };
  const data = object(value);
  if (data.version !== 2) throw new Error('Phiên bản cấu hình AI chung chưa được hỗ trợ.');
  const profiles = object(data.profiles);
  return { version: 2, profiles: Object.fromEntries(AI_ROLES.map(({ id }) => {
    const profile = object(profiles[id]);
    const platforms: GlobalAiProfile['platforms'] = {};
    for (const [platform, values] of Object.entries(object(profile.platforms ?? {}))) {
      if (!(ROLE_PLATFORMS[id] as string[]).includes(platform)) throw new Error('Nền tảng không phù hợp với AI này.');
      platforms[platform as AiPlatform] = fields(values, true);
    }
    return [id, { base: fields(profile.base, false) as GlobalAiBasics, platforms }];
  })) as GlobalAiConfiguration['profiles'] };
}

export async function readAiGlobalSettings(db: Pick<Pool, 'query'> = getMessengerPool()) {
  const row = (await db.query('SELECT * FROM ai_global_settings WHERE id=1')).rows[0];
  if (!row) throw new Error('Missing AI settings migration');
  // Bản lưu kiểu cũ (version 1, nhiều trường) không còn dùng: quay về mặc định, admin lưu lại là ghi đè.
  const configuration = row.document?.version === 2 ? parseGlobalAiConfiguration(row.document) : defaultGlobalAiConfiguration();
  // Bản lưu từ trước khi có lớp TikTok/Google của Smart Sourcing: dùng lớp mặc định tới khi admin lưu lớp đó.
  configuration.profiles.sourcing.platforms.tiktok ??= { ...SOURCING_TIKTOK_DEFAULT };
  configuration.profiles.sourcing.platforms.google ??= { ...SOURCING_GOOGLE_DEFAULT };
  return { configuration, revision: Number(row.revision), updatedAt: Number(row.updated_at), updatedBy: row.updated_by as string };
}

export async function requireAiAdministrator(request: Request) {
  const session = await requireAppAccess(request);
  if (session.role !== 'admin') throw new AppSecurityError('Chỉ quản trị viên được quản lý cấu hình AI chung.', 403, 'ADMIN_REQUIRED');
  return session;
}

export async function saveAiGlobalSettings(input: Record<string, unknown>, actor: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new AppSecurityError('Phiên bản cấu hình không hợp lệ.', 400, 'INVALID_AI_SETTINGS');
  let configuration;
  try { configuration = parseGlobalAiConfiguration(input.configuration); }
  catch (error) { throw new AppSecurityError(error instanceof Error ? error.message : 'Cấu hình AI không hợp lệ.', 400, 'INVALID_AI_SETTINGS'); }
  const updated = await db.query(`UPDATE ai_global_settings SET document=$1::jsonb,revision=revision+1,updated_at=$2,updated_by=$3
    WHERE id=1 AND revision=$4 RETURNING id`, [JSON.stringify(configuration), Date.now(), actor, input.revision]);
  if (!updated.rowCount) throw new AppSecurityError('Cấu hình chung đã thay đổi. Tải lại trước khi lưu.', 409, 'STALE_AI_SETTINGS');
  return readAiGlobalSettings(db);
}

/** Tầng Global → Platform (admin). Mục trống kế thừa; từ cấm cộng dồn để Platform không gỡ được từ cấm Global. */
export function effectiveGlobalAi(profile: GlobalAiProfile, platform?: string): GlobalAiBasics {
  const layer = platform ? profile.platforms[platform as AiPlatform] : undefined;
  const merged = { ...profile.base };
  for (const key of KEYS) if (key !== 'forbidden' && layer?.[key]) merged[key] = layer[key]!;
  merged.forbidden = [profile.base.forbidden, layer?.forbidden].filter(Boolean).join(', ');
  return merged;
}

/** Tầng Page (shop): cấu hình chi tiết từng AI cho một Page, Page thuộc một nền tảng.
 * shortcut: một tài khoản = một shop = một Page (app_users.page_id); tách bảng shops/pages khi shop có nhiều Page thật. */
export async function readPageProfile(pageId: string, db: Pick<Pool, 'query'> = getMessengerPool()) {
  const row = (await db.query('SELECT * FROM ai_page_profiles WHERE page_id=$1', [pageId])).rows[0];
  return { pageId, platform: (row?.platform ?? 'facebook') as AiPlatform, revision: Number(row?.revision ?? 0),
    configuration: row ? parseAiConfiguration(row.document) : defaultAiConfiguration(), updatedAt: Number(row?.updated_at ?? 0) };
}

/** shop_id lấy từ phiên, không nhận từ client; chủ shop chỉ thao tác trên Page gắn với shop mình. */
export async function requirePageOwner(request: Request, pageId: unknown) {
  const session = await requireAppAccess(request);
  if (session.role !== 'user' || !session.userId || !session.pageId || pageId !== session.pageId)
    throw new AppSecurityError('Bạn chỉ quản lý được cấu hình AI của Page thuộc shop mình.', 403, 'PAGE_FORBIDDEN');
  return { shopId: session.userId, pageId: session.pageId, actor: session.username };
}

export async function savePageProfile(owner: { shopId: string; pageId: string; actor: string }, input: Record<string, unknown>, db: Pick<Pool, 'query'> = getMessengerPool()) {
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new AppSecurityError('Phiên bản cấu hình không hợp lệ.', 400, 'INVALID_AI_SETTINGS');
  let document;
  try { document = parseAiConfiguration({ ...(input.configuration as object), updatedAt: Date.now() }); }
  catch (error) { throw new AppSecurityError(error instanceof Error ? error.message : 'Cấu hình AI không hợp lệ.', 400, 'INVALID_AI_SETTINGS'); }
  const now = Date.now(), revision = Number(input.revision), body = JSON.stringify(document);
  // shortcut: Page demo là Facebook Page cấu hình qua PAGE_ID; nhận platform từ kết nối Page khi có nhiều nền tảng thật.
  const saved = revision === 0
    ? await db.query(`INSERT INTO ai_page_profiles(page_id,shop_id,platform,document,updated_at,updated_by) VALUES($1,$2,'facebook',$3::jsonb,$4,$5)
        ON CONFLICT DO NOTHING RETURNING page_id`, [owner.pageId, owner.shopId, body, now, owner.actor])
    : await db.query(`UPDATE ai_page_profiles SET document=$3::jsonb,revision=revision+1,updated_at=$4,updated_by=$5
        WHERE page_id=$1 AND shop_id=$2 AND revision=$6 RETURNING page_id`, [owner.pageId, owner.shopId, body, now, owner.actor, revision]);
  if (!saved.rowCount) throw new AppSecurityError('Cấu hình AI đã thay đổi. Tải lại trước khi lưu.', 409, 'STALE_AI_SETTINGS');
  return readPageProfile(owner.pageId, db);
}

/** Hồ sơ shop của một AI trên Page. AI Chat giữ nguồn duy nhất ở messenger_ai_settings (có luồng xác nhận riêng). */
async function shopProfile(role: AiRoleId, pageId: string): Promise<{ profile: AiProfile; platform: AiPlatform } | null> {
  const db = getMessengerPool();
  if (role === 'chat') {
    const row = (await db.query('SELECT profile_json FROM messenger_ai_settings WHERE page_id=$1', [pageId])).rows[0];
    if (!row?.profile_json) return null;
    const defaults = defaultAiConfiguration();
    return { profile: parseAiConfiguration({ ...defaults, profiles: { ...defaults.profiles, chat: row.profile_json } }).profiles.chat, platform: 'facebook' };
  }
  const page = await readPageProfile(pageId, db);
  return page.revision ? { profile: page.configuration.profiles[role], platform: page.platform } : null;
}

/** Chỗ ghép duy nhất: Global → Platform (admin) → Page (shop). Mọi lời gọi Gemini đi qua đây. */
export async function globalAiSystemPrompt(role: AiRoleId, platform?: string, pageId?: string, includeShop = true) {
  const { configuration } = await readAiGlobalSettings();
  // shortcut: demo chạy một Page cấu hình sẵn; truyền pageId ở mọi nơi gọi khi có nhiều Page thật.
  const page = pageId ?? process.env.PAGE_ID?.trim();
  const shop = includeShop && page ? await shopProfile(role, page) : null;
  const target = platform ?? shop?.platform;
  const scope = ROLE_PLATFORMS[role].includes(target as AiPlatform) ? target as AiPlatform : undefined;
  const basics = effectiveGlobalAi(configuration.profiles[role], scope);
  const admin = `THIẾT LẬP CHUNG DO TENDLY ĐẶT (không được vượt):\n${KEYS.filter(key => basics[key]).map(key => `- ${GLOBAL_AI_FIELDS[key]}: ${basics[key]}`).join('\n')}
Tuyệt đối không dùng các từ cấm. Không bỏ qua giới hạn an toàn, xác thực dữ kiện hoặc yêu cầu phê duyệt của hệ thống.`;
  if (!shop) return admin;
  const { profile } = shop;
  return `${admin}\n\nCÁ NHÂN HÓA CỦA SHOP CHO PAGE NÀY (chỉ áp dụng trong phạm vi thiết lập chung ở trên):\n${JSON.stringify({
    goal: profile.goal, input: profile.input, output: profile.output, instructions: profile.instructions || undefined, rules: effectiveAiRules(profile, scope) })}`;
}
