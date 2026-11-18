import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { publicSourcingRun, SourcingRunError } from '@/lib/services/sourcingRuns';
import { SourcingInputError } from '@/lib/services/sourcingSearch';
import type { CampaignBrief } from '@/lib/types/marketingWorkspace';
import type { ContentFormat, SourcingAnalysis, SourcingRun } from '@/lib/types/sourcing';

/** Đề xuất trong báo cáo Smart Sourcing muốn gửi sang AI Marketing: sản phẩm hot (TikTok) hoặc ý tưởng nội dung (theo dõi thị trường). */
export interface SourcingIdeaRef { section: 'product' | 'content'; index: number }
/** Không điền ô link của brief: ô đó là link gắn vào bài đăng (sau CTA), còn nguồn khảo sát có thể là trang của đối thủ. Nguồn chỉ ghi trong notes. */
export type SourcingBriefSeed = Pick<CampaignBrief, 'name' | 'goal' | 'audience' | 'pain' | 'message' | 'benefits' | 'barriers' | 'format' | 'startsAt' | 'endsAt' | 'notes'> & { itemKey: string };

export const FORMAT_LABEL: Record<ContentFormat, string> = { post: 'Bài đăng Facebook', video: 'Video ngắn (Reels/TikTok)', infographic: 'Infographic', blog: 'Bài blog / website' };
const clip = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const lines = (label: string, list: string[]) => list.length ? `${label}:\n${list.map(item => `- ${item}`).join('\n')}` : '';
const sourceLine = (urls: string[]) => urls.length ? `Nguồn khảo sát (chỉ để tham khảo, không đưa link vào bài): ${urls.join(' ')}` : '';

export function parseSourcingIdeaRef(value: unknown): SourcingIdeaRef {
  const ref = value as Partial<SourcingIdeaRef> | null;
  if (!ref || (ref.section !== 'product' && ref.section !== 'content') || !Number.isInteger(ref.index) || ref.index! < 0 || ref.index! > 20) throw new SourcingInputError('Đề xuất không hợp lệ.');
  return { section: ref.section, index: ref.index! };
}

/** Dựng brief nháp từ báo cáo đã lưu trên server, không nhận nội dung brief từ trình duyệt. Ngày tháng theo dịp do lịch của code tính. */
export function briefFromAnalysis(analysis: SourcingAnalysis, ref: SourcingIdeaRef, urlOf: (key: string) => string, now = Date.now()): SourcingBriefSeed {
  if (ref.section === 'content') {
    const market = analysis.market, idea = market?.contentIdeas[ref.index];
    if (!market || !idea) throw new SourcingRunError('Đề xuất nội dung không còn trong báo cáo.', 404);
    const occasion = market.occasions.find(item => item.name === idea.occasion);
    // Chạy từ hôm nay tới hết ngày của dịp (giờ Việt Nam); dịp đã qua hoặc không gắn dịp thì để shop tự chọn lịch.
    const end = occasion?.date ? Date.parse(`${occasion.date}T23:59:00+07:00`) : NaN;
    const related = market.news.filter(news => news.sources.some(source => idea.sources.includes(source))).map(news => `${news.title}: ${news.action}`);
    const rivals = market.competitors.filter(rival => rival.sources.some(source => idea.sources.includes(source))).map(rival => `${rival.name}: ${rival.takeaway || rival.activity}`);
    const notes = [
      `Đề xuất từ Smart Sourcing (theo dõi thị trường): ${idea.angle}`,
      idea.hook && `Câu mở đầu gợi ý: ${idea.hook}`,
      idea.keywords.length ? `Từ khóa nên dùng: ${idea.keywords.join(', ')}` : '',
      occasion ? `Dịp: ${occasion.name} (${occasion.date}). ${occasion.angle}` : '',
      lines('Tin liên quan', related), lines('Đối thủ', rivals),
      'Chưa chọn sản phẩm đang bán và ưu đãi; kiểm tra lại thông tin trước khi duyệt.',
      sourceLine(idea.sources.slice(0, 2).map(urlOf).filter(Boolean)),
    ].filter(Boolean).join('\n');
    return { itemKey: `idea:content:${ref.index}`, name: clip(`${FORMAT_LABEL[idea.format]}: ${idea.title}`, 150), goal: occasion ? 'conversion' : 'engagement',
      audience: clip(idea.audience, 1500), pain: '', message: clip(idea.angle, 1500), benefits: '', barriers: '', format: FORMAT_LABEL[idea.format],
      startsAt: Number.isFinite(end) && end > now ? new Date(now).toISOString() : '', endsAt: Number.isFinite(end) && end > now ? new Date(end).toISOString() : '',
      notes: clip(notes, 1500) };
  }
  const idea = analysis.productIdeas[ref.index], report = analysis.report;
  if (!idea) throw new SourcingRunError('Sản phẩm đề xuất không còn trong báo cáo.', 404);
  const texts = (list: { text: string }[] | undefined) => (list ?? []).slice(0, 4).map(point => point.text);
  const notes = [
    `Sản phẩm đang được quan tâm trên TikTok (Smart Sourcing): ${idea.reason}`,
    lines('Cách mở đầu video hiệu quả', texts(report?.hooks)), lines('Kiểu video hiệu quả', texts(report?.formats)),
    report && (report.keywords.length || report.hashtags.length) ? `Từ khóa / hashtag: ${[...report.keywords.map(point => point.text), ...report.hashtags].join(', ')}` : '',
    'Chưa xác nhận sản phẩm đang bán, giá bán, tồn kho hoặc chất lượng nguồn hàng.',
    sourceLine(idea.sources.slice(0, 2).map(urlOf).filter(Boolean)),
  ].filter(Boolean).join('\n');
  return { itemKey: `idea:product:${ref.index}`, name: clip(`Ý tưởng: ${idea.name}`, 150), goal: 'launch',
    audience: clip(texts(report?.audience).join('; '), 1500), pain: clip(texts(report?.hesitations).join('; '), 1500), message: clip(idea.name, 1500),
    benefits: clip(texts(report?.drivers).join('; '), 1500), barriers: clip(texts(report?.hesitations).join('; '), 1500),
    format: report?.formats.length ? 'Video ngắn (Reels/TikTok)' : 'Bài bán hàng', startsAt: '', endsAt: '', notes: clip(notes, 1500) };
}

/** db: truyền client của transaction đang mở (Marketing giữ khóa workspace) để không chờ một kết nối thứ hai. */
export async function readSourcingBriefSeed(owner: string, runId: unknown, refValue: unknown, db: Pick<Pool, 'query'> = getMessengerPool()): Promise<SourcingBriefSeed> {
  if (typeof runId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId)) throw new SourcingInputError('Lượt tìm không hợp lệ.');
  const ref = parseSourcingIdeaRef(refValue);
  const row = (await db.query('SELECT * FROM sourcing_runs WHERE id=$1 AND owner=$2', [runId, owner])).rows[0];
  if (!row) throw new SourcingRunError('Lượt tìm không tồn tại.', 404);
  const run = publicSourcingRun(row) as SourcingRun;
  if (!run.analysis) throw new SourcingRunError('Lượt tìm chưa có báo cáo AI.', 409);
  const urls = new Map([...(run.result?.posts ?? []).map(post => [JSON.stringify([post.source, post.externalId]), post.url] as const),
    ...(run.result?.candidates ?? []).map(item => [JSON.stringify(['google', item.url]), item.url] as const)]);
  return briefFromAnalysis(run.analysis, ref, key => urls.get(key) ?? '');
}
