import { hotScore, normalizeSourcingPosts, prepareSourcingSearch, SourcingInputError, type SourcingComment } from '@/lib/services/sourcingSearch';
import { resolveOccasions } from '@/lib/services/sourcingOccasions';
import type { SourcingKind, SupplierCandidate } from '@/lib/types/sourcing';

export type { SourcingKind };
export const sourcingActors = { tiktok: 'clockworks/tiktok-scraper', suppliers: 'apify/google-search-scraper', market: 'apify/google-search-scraper' } as const;
// Trần phí Apify cho mỗi lượt chạy (maxTotalChargeUsd). Apify từ chối trần dưới 0,5 USD (max-total-charge-usd-below-minimum), nên đây là mức thấp nhất dùng được.
// Chi phí thật bị chặn bởi khối lượng (TIKTOK_MAX_RESULTS × COMMENTS_PER_POST), không phải bởi trần.
export const sourcingBudgetUsd = { tiktok: 0.5, suppliers: 0.5, market: 0.5 } as const;
/** Theo dõi thị trường: tối đa 6 truy vấn Google × 1 trang (~10 kết quả), giữ tối đa 30 kết quả cho AI đọc. */
export const MARKET_MAX_QUERIES = 6;
export const MARKET_MAX_RESULTS = 30;
export const MARKET_WINDOWS = { w1: '7 ngày qua', m1: '1 tháng qua', m3: '3 tháng qua' } as const;
export type MarketWindow = keyof typeof MARKET_WINDOWS;
// Giá thật mỗi lượt: ~0,0064 USD/video + ~0,00125 USD/bình luận; 15 video × 5 bình luận ≈ 0,19 USD.
export const TIKTOK_MAX_RESULTS = 15;
const COMMENTS_PER_POST = 5;

export class SourcingProviderError extends Error {
  constructor(message: string, readonly status = 502, readonly code = 'APIFY_ERROR') { super(message); }
}

export function apifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new SourcingProviderError('Chưa cấu hình APIFY_API_TOKEN trên server.', 503, 'APIFY_NOT_CONFIGURED');
  return token;
}

export function sourcingRequest(kind: SourcingKind, input: Record<string, unknown>, now = new Date()) {
  if (kind === 'tiktok') {
    const plan = prepareSourcingSearch(input, now);
    if (input.keywords !== undefined && (!Array.isArray(input.keywords) || !input.keywords.length || input.keywords.length > 3
      || input.keywords.some(k => typeof k !== 'string' || k.trim().length < 2 || k.length > 120 || !/^[\p{L}\p{N}\s.,()&+%\/-]+$/u.test(k)))) throw new SourcingInputError('Truy vấn TikTok không hợp lệ.');
    const keywords = input.keywords === undefined ? plan.keywords : [...new Set((input.keywords as string[]).map(k => k.trim()))];
    const limit = input.resultLimit ?? TIKTOK_MAX_RESULTS;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > TIKTOK_MAX_RESULTS) throw new SourcingInputError(`Giới hạn kết quả TikTok phải từ 1–${TIKTOK_MAX_RESULTS}.`);
    return {
      context: { industry: plan.industry, keywords, market: plan.market, period: plan.period, resultLimit: limit },
      actorInput: {
        // Apify's input schema defines resultsPerPage as "per hashtag, profile, or search query", so split it to keep the paid total near `limit`.
        searchQueries: keywords, searchSection: '/video', resultsPerPage: Math.max(1, Math.floor(limit / Math.max(1, keywords.length))),
        proxyCountryCode: 'VN', videoSearchDateFilter: 'PAST_WEEK',
        shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false, shouldDownloadAvatars: false, shouldDownloadMusicCovers: false,
        scrapeRelatedVideos: false, scrapeRelatedSearchWords: false,
        maxFollowersPerProfile: 0, maxFollowingPerProfile: 0, commentsPerPost: COMMENTS_PER_POST,
      },
    };
  }
  if (kind === 'market') return marketRequest(input, now);
  const product = typeof input.product === 'string' ? input.product.trim().replace(/\s+/g, ' ') : '';
  if (product.length < 2 || product.length > 120 || /[\u0000-\u001f\u007f]/.test(product)
    || !/^[\p{L}\p{N}\s.,()&+%\/-]+$/u.test(product) || product.split(' ').length > 16) {
    throw new SourcingInputError('Tên sản phẩm cần từ 2–120 ký tự, tối đa 16 từ; không nhập URL hoặc cú pháp tìm kiếm.');
  }
  const region = input.region ?? 'Việt Nam';
  if (typeof region !== 'string' || !region.trim() || region.length > 100 || !/^[\p{L}\p{N} .,()-]+$/u.test(region)) throw new SourcingInputError('Khu vực nhà cung cấp không hợp lệ.');
  const queries = [`${product} bán sỉ ${region}`, `${product} nhà sản xuất nhà phân phối ${region}`];
  const limit = input.resultLimit ?? 20;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new SourcingInputError('Giới hạn kết quả phải từ 1–20.');
  return {
    context: { product, queries, market: 'VN', resultLimit: limit },
    actorInput: {
      queries: queries.join('\n'), countryCode: 'vn', languageCode: 'vi', maxPagesPerQuery: 1,
      focusOnPaidAds: false, aiOverview: { scrapeFullAiOverview: false },
      aiModeSearch: { enableAiMode: false }, websiteContentScraper: { enable: true },
    },
  };
}

const SAFE_TERM = /^[\p{L}\p{N}\s.,()&+%\/'-]+$/u;
const term = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
/** Đối thủ: tên thương hiệu, link website hoặc link fanpage Facebook. Trả truy vấn Google tương ứng, không nhận cú pháp tìm kiếm tự gõ. */
export function competitorQuery(value: unknown) {
  const raw = term(value);
  if (raw.length < 2 || raw.length > 200 || /[\u0000-\u001f\u007f"]/.test(raw)) throw new SourcingInputError('Đối thủ cần là tên (2–120 ký tự) hoặc link website/fanpage.');
  if (/^(https?:\/\/|www\.|[a-z0-9-]+\.(com|vn|net|shop|store|com\.vn)(\/|$))/i.test(raw)) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new SourcingInputError('Link đối thủ không hợp lệ.'); }
    const host = url.hostname.replace(/^(www|m|web)\./, '').toLowerCase();
    if (url.username || url.password || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new SourcingInputError('Link đối thủ không hợp lệ.');
    if (host === 'facebook.com' || host === 'fb.com') {
      // Fanpage ít được Google lập chỉ mục theo bài; tìm theo tên trang để ra cả báo chí, bài PR nhắc tới đối thủ.
      const page = url.pathname.split('/').filter(Boolean)[0] ?? '';
      if (!/^[A-Za-z0-9.\-]{2,80}$/.test(page) || ['profile.php', 'pages', 'groups'].includes(page)) throw new SourcingInputError('Link fanpage cần dạng facebook.com/ten-trang.');
      return { label: `facebook.com/${page}`, query: `"${page.replace(/[.\-]+/g, ' ')}"` };
    }
    return { label: host, query: `site:${host}` };
  }
  if (raw.length > 120 || !SAFE_TERM.test(raw)) throw new SourcingInputError('Tên đối thủ chỉ gồm chữ, số và dấu câu thông thường.');
  return { label: raw, query: `"${raw}"` };
}

/** Lượt theo dõi thị trường: tin tức ngành, xu hướng, dịp bán hàng sắp tới và động thái đối thủ trên Google trong khoảng thời gian chọn. */
function marketRequest(input: Record<string, unknown>, now: Date) {
  const industry = term(input.industry);
  const topic = term(input.product) || (Array.isArray(input.keywords) ? term(input.keywords[0]) : '') || industry;
  if (topic.length < 2 || topic.length > 120 || !SAFE_TERM.test(topic)) throw new SourcingInputError('Nhập chủ đề/ngành cần theo dõi (2–120 ký tự, không nhập URL).');
  const keywords = (Array.isArray(input.keywords) ? input.keywords : []).map(term).filter(k => k && k !== topic);
  if (keywords.length > 3 || keywords.some(k => k.length < 2 || k.length > 120 || !SAFE_TERM.test(k))) throw new SourcingInputError('Tối đa 3 từ khóa theo dõi, mỗi từ khóa 2–120 ký tự.');
  const competitors = (Array.isArray(input.competitors) ? input.competitors : []);
  if (competitors.length > 3) throw new SourcingInputError('Theo dõi tối đa 3 đối thủ mỗi lượt.');
  const rivals = competitors.map(competitorQuery);
  const occasionNames = (Array.isArray(input.occasions) ? input.occasions : []).map(term).filter(Boolean);
  if (occasionNames.length > 2 || occasionNames.some(name => name.length > 60 || !SAFE_TERM.test(name))) throw new SourcingInputError('Chọn tối đa 2 dịp bán hàng.');
  const occasions = resolveOccasions(occasionNames, now);
  const window = (input.window ?? 'm1') as MarketWindow;
  if (!(window in MARKET_WINDOWS)) throw new SourcingInputError('Khoảng thời gian theo dõi không hợp lệ.');
  const year = now.getUTCFullYear();
  // Ưu tiên đối thủ và dịp do shop chọn; tin ngành và xu hướng luôn có; từ khóa phụ lấp chỗ còn lại.
  const queries = [...new Set([
    `${topic} tin tức thị trường`, `xu hướng ${topic} ${year}`,
    ...occasions.map(occasion => `${topic} ${occasion.name.replace(/\s*\d+\/\d+$/, '')} ${occasion.date.slice(0, 4) || year}`),
    ...rivals.map(rival => rival.query),
    ...keywords.map(keyword => `${keyword} tin tức`),
  ])].slice(0, MARKET_MAX_QUERIES);
  const limit = input.resultLimit ?? MARKET_MAX_RESULTS;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MARKET_MAX_RESULTS) throw new SourcingInputError(`Giới hạn kết quả phải từ 1–${MARKET_MAX_RESULTS}.`);
  return {
    context: { industry, topic, keywords, competitors: rivals.map(rival => rival.label), occasions, window, queries, market: 'VN', resultLimit: limit },
    actorInput: {
      queries: queries.join('\n'), countryCode: 'vn', languageCode: 'vi', maxPagesPerQuery: 1, quickDateRange: window,
      focusOnPaidAds: false, aiOverview: { scrapeFullAiOverview: false },
      aiModeSearch: { enableAiMode: false }, websiteContentScraper: { enable: true },
    },
  };
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const providerId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9]{1,64}$/.test(value) ? value : '';

export async function apifyRequest(path: string, token: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`https://api.apify.com/v2/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000), cache: 'no-store', redirect: 'error',
    });
  } catch {
    throw new SourcingProviderError('Không nhận được phản hồi từ Apify. Không tự gửi lại lượt chạy để tránh phát sinh phí trùng.', 502, 'APIFY_UNAVAILABLE');
  }
  if (!response.ok) {
    throw new SourcingProviderError('Apify không xử lý được yêu cầu. Kiểm tra token, quyền Actor và số dư trong Console.', 502,
      response.status < 500 ? 'APIFY_REJECTED' : 'APIFY_UNAVAILABLE');
  }
  try { return await response.json(); }
  catch { throw new SourcingProviderError('Dữ liệu phản hồi từ Apify không hợp lệ.', 502, 'APIFY_BAD_RESPONSE'); }
}

export function parseApifyRun(payload: unknown) {
  const data = record(record(payload).data);
  const id = providerId(data.id);
  const status = text(data.status);
  if (!id || !['READY', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMING-OUT', 'TIMED-OUT', 'ABORTING', 'ABORTED'].includes(status)) {
    throw new SourcingProviderError('Trạng thái lượt chạy Apify không hợp lệ.', 502, 'APIFY_BAD_RESPONSE');
  }
  return { id, status, datasetId: providerId(data.defaultDatasetId) };
}

export async function startApifyRun(kind: SourcingKind, actorInput: unknown, token: string) {
  const actor = sourcingActors[kind].replace('/', '~');
  // No automatic POST retry: a lost response can still mean a billable run was created.
  return parseApifyRun(await apifyRequest(`actors/${actor}/runs?timeout=300&maxTotalChargeUsd=${sourcingBudgetUsd[kind]}`, token, actorInput));
}

const metricValue = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
/** Chỉ nhận dataset trên api.apify.com để không gửi token tới host lạ. */
function commentsDataset(item: unknown) {
  const raw = record(item);
  try {
    const url = new URL(text(raw.commentsDatasetUrl ?? raw.commentsDatasetURL));
    return url.protocol === 'https:' && url.hostname === 'api.apify.com' ? url.pathname.match(/^\/v2\/datasets\/([A-Za-z0-9]{1,64})\/items\/?$/)?.[1] ?? '' : '';
  } catch { return ''; }
}
export const commentDatasets = (items: unknown[]) => [...new Set(items.map(commentsDataset).filter(Boolean))];

/** Gom bình luận theo id video: theo videoWebUrl của bình luận; dataset chỉ của một video thì gán cho video đó. Giữ bình luận nhiều thích nhất. */
export function groupTikTokComments(items: unknown[], datasets: Record<string, unknown[]>, perPost = COMMENTS_PER_POST) {
  const owners = new Map<string, string[]>();
  for (const item of items) {
    const dataset = commentsDataset(item), video = text(record(item).id);
    if (dataset && video && !owners.get(dataset)?.includes(video)) owners.set(dataset, [...owners.get(dataset) ?? [], video]);
  }
  const byVideo = new Map<string, SourcingComment[]>();
  for (const [dataset, rows] of Object.entries(datasets)) for (const row of rows) {
    const raw = record(row), body = text(raw.text);
    const only = owners.get(dataset)?.length === 1 ? owners.get(dataset)![0] : '';
    const video = text(raw.videoWebUrl).match(/\/video\/(\d+)/)?.[1] || only;
    if (body && video) byVideo.set(video, [...byVideo.get(video) ?? [], { text: body.slice(0, 300), likes: metricValue(raw.diggCount) }]);
  }
  for (const [video, list] of byVideo) byVideo.set(video, list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, perPost));
  return byVideo;
}

/** Tìm theo từ khóa tiếng Việt vẫn trả video nước ngoài. Giữ video tiếng Việt, hoặc caption chỉ có hashtag/ký hiệu ("un") đăng từ VN; thiếu field thì giữ (Actor đổi schema không làm mất hết dữ liệu).
 * shortcut: tin nhãn ngôn ngữ của TikTok nên caption hashtag-only đăng từ VN vẫn lọt dù lạc ngành; ngành do AI loại. */
export function isVietnamese(raw: Record<string, unknown>) {
  const lang = text(raw.textLanguage), place = text(raw.locationCreated);
  return lang === 'vi' || ((!lang || lang === 'un') && (!place || place === 'VN'));
}

export function normalizeTikTok(allItems: unknown[], period: { from: string; to: string }, now = new Date(), comments = new Map<string, SourcingComment[]>()) {
  const items = allItems.filter(item => isVietnamese(record(item)));
  const normalized = normalizeSourcingPosts(items.map(item => {
    const raw = record(item);
    const author = record(raw.authorMeta);
    const seconds = typeof raw.createTime === 'number' && Number.isFinite(raw.createTime) ? raw.createTime : NaN;
    const time = seconds * 1000;
    const publishedAt = text(raw.createTimeISO) || (Number.isFinite(time) && Math.abs(time) <= 8.64e15 ? new Date(time).toISOString() : null);
    return {
      source: 'tiktok', externalId: text(raw.id), url: text(raw.webVideoUrl), text: text(raw.text),
      authorId: text(author.id) || text(author.name) || text(raw['authorMeta.name']) || null,
      publishedAt, views: raw.playCount as number, likes: raw.diggCount as number,
      comments: raw.commentCount as number, shares: raw.shareCount as number,
      ...(comments.has(text(raw.id)) ? { topComments: comments.get(text(raw.id)) } : {}),
    };
  }), now);
  const from = Date.parse(period.from), to = Date.parse(period.to);
  // Xếp theo điểm hot trước khi cắt theo giới hạn; thứ tự S1, S2… của báo cáo AI chính là thứ hạng này.
  const posts = normalized.posts.filter(post => post.publishedAt && Date.parse(post.publishedAt) >= from && Date.parse(post.publishedAt) < to)
    .sort((a, b) => hotScore(b, now.getTime()) - hotScore(a, now.getTime()));
  return {
    ...normalized, posts,
    excludedByDateCount: normalized.posts.length - posts.length,
    excludedByLanguageCount: allItems.length - items.length,
    coverage: 'sample' as const,
    message: 'Mẫu bài TikTok theo truy vấn và proxy VN; không bảo đảm tác giả/người xem ở Việt Nam. Chưa phân tích AI hoặc xác nhận xu hướng.',
  };
}

function supplierUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['gclid', 'fbclid'].includes(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

// shortcut: giữ đầu trang (giới thiệu, chính sách sỉ) và cuối trang (footer liên hệ); tách theo mục nếu thông tin hay nằm giữa trang.
const condensePage = (page: string) => page.length > 4000 ? `${page.slice(0, 3000)}
…
${page.slice(-1000)}` : page;

export function normalizeSupplierResults(items: unknown[], now = new Date()) {
  const candidates = new Map<string, SupplierCandidate>();
  let rejectedCount = 0, duplicateCount = 0;
  for (const item of items) {
    const page = record(item);
    if (!Array.isArray(page.organicResults)) throw new SourcingProviderError('Output Google thiếu organicResults; cần kiểm tra schema Actor.', 502, 'APIFY_BAD_DATASET');
    const query = text(record(page.searchQuery).term);
    for (const value of page.organicResults) {
      const raw = record(value);
      const url = supplierUrl(raw.url), title = text(raw.title);
      if (!url || !title) { rejectedCount++; continue; }
      const existing = candidates.get(url);
      if (existing) {
        duplicateCount++;
        if (query && !existing.queries.includes(query)) existing.queries.push(query);
        continue;
      }
      candidates.set(url, { title, url, description: text(raw.description), page: condensePage(text(record(raw.websiteContent).text)),
        position: typeof raw.position === 'number' && Number.isSafeInteger(raw.position) && raw.position > 0 ? raw.position : null,
        queries: query ? [query] : [], verified: false, collectedAt: now.toISOString(), source: 'google',
        price: null, currency: null, unit: null, moq: null, region: null, leadTime: null });
    }
  }
  return { candidates: [...candidates.values()], rejectedCount, duplicateCount,
    message: 'Đầu mối từ kết quả Google; chưa đọc trang gốc, chưa xác minh bán sỉ, giá hoặc MOQ.' };
}
/** Kết quả theo dõi thị trường: cùng định dạng Google nhưng là tin/bài tham khảo, không phải nhà cung cấp. */
export function normalizeMarketResults(items: unknown[], now = new Date()) {
  return { ...normalizeSupplierResults(items, now), message: 'Tin và bài viết từ kết quả Google trong khoảng thời gian đã chọn; chưa xác minh độ chính xác.' };
}
