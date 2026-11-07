import type { CampaignBrief, MarketingAccount, MarketingProfile, MarketingWorkspace } from '@/lib/types/marketingWorkspace';
import type { PostGoal } from '@/lib/types/posts';

export const MARKETING_GOALS = { launch: 'Giới thiệu sản phẩm', conversion: 'Ra đơn', live: 'Mời xem Livestream', engagement: 'Tương tác', clearance: 'Xả hàng' } as const;
export const MARKETING_POST_GOALS: Record<string, PostGoal> = { launch: 'new-product', conversion: 'promotion', live: 'engagement', engagement: 'engagement', clearance: 'clearance' };
export const MARKETING_SCENARIOS = ['Một lần', 'Hằng tuần', 'Dịp lễ / sự kiện', 'Kích sale', 'Ra mắt sản phẩm', 'Livestream', 'Xả hàng', 'Tự sắp xếp'];
export const emptyMarketingWorkspace = (): MarketingWorkspace => ({ profiles: {}, campaigns: [], reviews: [], schedules: [] });
export const emptyMarketingProfile = (): MarketingProfile => ({ name: '', purpose: 'Bán hàng', audience: '', pain: '', address: 'shop – bạn', tone: 'Gần gũi, rõ ràng', approach: '', format: '', cta: 'Nhắn tin để được tư vấn', avoid: 'Cam kết tuyệt đối, tốt nhất, đảm bảo 100%', examples: '' });
export const emptyCampaignBrief = (accountId = ''): CampaignBrief => ({ name: '', accountId, goal: 'launch', productIds: [], audience: '', pain: '', message: '', benefits: '', barriers: '', tone: '', format: 'Bài bán hàng', cta: '', link: '', startsAt: '', endsAt: '', notes: '', offer: { kind: 'none', details: '', conditions: '', startsAt: '', endsAt: '', confirmed: false }, proof: '', proofSource: '' });
export class MarketingWorkflowError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function marketingText(value: unknown, label: string, max = 1500, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new MarketingWorkflowError(`${label}: nhập nội dung hợp lệ, tối đa ${max} ký tự.`);
  return value.trim();
}
export function parseMarketingProfile(value: unknown): MarketingProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MarketingWorkflowError('Hồ sơ kênh không hợp lệ.');
  const data = value as Record<string, unknown>;
  const profile = Object.fromEntries(Object.keys(emptyMarketingProfile()).map(key => [key, marketingText(data[key], key, 1500, key === 'name' || key === 'tone')])) as unknown as MarketingProfile;
  const samples = data.samples ?? [];
  if (!Array.isArray(samples) || samples.length > MAX_SAMPLES) throw new MarketingWorkflowError(`Tối đa ${MAX_SAMPLES} bài viết mẫu.`);
  profile.samples = samples.map((sample, i) => marketingText(sample, `Bài viết mẫu ${i + 1}`, 5000)).filter(Boolean);
  return profile;
}
export const MAX_SAMPLES = 5;
export function parseCampaignBrief(value: unknown, accounts: MarketingAccount[]): CampaignBrief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MarketingWorkflowError('Brief không hợp lệ.');
  const data = value as Record<string, unknown>;
  const brief = emptyCampaignBrief();
  for (const key of Object.keys(brief).filter(key => key !== 'offer' && key !== 'productIds') as (Exclude<keyof CampaignBrief, 'offer' | 'productIds'>)[]) brief[key] = marketingText(data[key], key, key === 'name' ? 150 : 1500, key === 'name');
  if (!accounts.some(account => account.id === brief.accountId) || !Object.hasOwn(MARKETING_GOALS, brief.goal)) throw new MarketingWorkflowError('Tài khoản hoặc mục tiêu không hợp lệ.');
  if (!Array.isArray(data.productIds) || data.productIds.length > 5 || data.productIds.some(id => typeof id !== 'string' || id.length > 150)) throw new MarketingWorkflowError('Chọn tối đa 5 sản phẩm.');
  brief.productIds = [...new Set(data.productIds)] as string[];
  const offer = data.offer as Record<string, unknown>;
  if (!offer || !['none', 'discount', 'voucher', 'gift', 'combo', 'shipping'].includes(String(offer.kind)) || typeof offer.confirmed !== 'boolean') throw new MarketingWorkflowError('Ưu đãi không hợp lệ.');
  brief.offer = { kind: offer.kind as CampaignBrief['offer']['kind'], details: marketingText(offer.details, 'Nội dung ưu đãi'), conditions: marketingText(offer.conditions, 'Điều kiện'), startsAt: marketingText(offer.startsAt, 'Bắt đầu'), endsAt: marketingText(offer.endsAt, 'Kết thúc'), confirmed: offer.confirmed };
  for (const [start, end] of [[brief.startsAt, brief.endsAt], [brief.offer.startsAt, brief.offer.endsAt]]) {
    if ((start && !Number.isFinite(Date.parse(start))) || (end && !Number.isFinite(Date.parse(end))) || (start && end && Date.parse(start) >= Date.parse(end))) throw new MarketingWorkflowError('Kiểm tra thời gian bắt đầu và kết thúc.');
  }
  if (brief.link || brief.proofSource) for (const link of [brief.link, brief.proofSource].filter(Boolean)) {
    try { const url = new URL(link); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { throw new MarketingWorkflowError('Link phải là URL http/https hợp lệ.'); }
  }
  if (brief.proof && !brief.proofSource) throw new MarketingWorkflowError('Feedback cần có link nguồn xác nhận.');
  return brief;
}
export function requireCampaignReady(brief: CampaignBrief, now = Date.now()) {
  for (const key of ['audience', 'pain', 'message', 'format', 'cta'] as const) if (!brief[key]) throw new MarketingWorkflowError('Bổ sung đối tượng, nhu cầu, thông điệp, định dạng và CTA trước khi duyệt.');
  if (!brief.productIds.length) throw new MarketingWorkflowError('Chọn ít nhất một sản phẩm.');
  if (brief.offer.kind !== 'none' && (!brief.offer.confirmed || !brief.offer.details || !brief.offer.conditions || !brief.offer.startsAt || !brief.offer.endsAt || Date.parse(brief.offer.endsAt) <= now)) throw new MarketingWorkflowError('Xác nhận nội dung, điều kiện và thời gian ưu đãi còn hiệu lực.');
}
export function offerValidAt(brief: CampaignBrief, at: number) {
  return brief.offer.kind === 'none' || (brief.offer.confirmed && Date.parse(brief.offer.startsAt) <= at && at < Date.parse(brief.offer.endsAt));
}
// Expand only the finite, explicit range the user previews and approves.
export function weeklyMarketingDates(start: string, days: number[], time: string, weeks: number): number[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(weeks) || weeks < 1 || weeks > 12 || !days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new MarketingWorkflowError('Chọn ngày, giờ, thứ và 1–12 tuần hợp lệ.');
  const first = Date.parse(`${start}T${time}:00+07:00`);
  if (!Number.isFinite(first) || new Date(first + 7 * 3600000).toISOString().slice(0, 10) !== start) throw new MarketingWorkflowError('Ngày không hợp lệ.');
  return Array.from({ length: weeks * 7 }, (_, i) => first + i * 86400000).filter(at => days.includes(new Date(at + 7 * 3600000).getUTCDay()));
}
