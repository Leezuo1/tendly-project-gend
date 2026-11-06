import { createHash } from 'node:crypto';
import { normalize } from '@/lib/utils/format';
import type { AiKnowledge } from '@/lib/types/ai';
import type { GeneratedPostDraft } from '@/lib/types/posts';
import type { ReviewEvidence, ReviewIssue, ReviewSource } from '@/lib/types/postReview';

// JSONB reorders object keys; fingerprints must survive a database round trip.
export const reviewHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)).digest('hex');
const pick = (value: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
export const draftText = (drafts: GeneratedPostDraft[]) => drafts.map(d => [d.title, d.content, d.imageIdea, d.imagePrompt].join('\n')).join('\n');
export const blockingIssue = (type: ReviewIssue['type'], message: string, sourceIds: string[] = [], field: ReviewIssue['field'] = ''): ReviewIssue => ({ type, severity: 'blocking', field, message, sourceIds });

export function knowledgeReviewSources(knowledge: AiKnowledge, scope: string, origin: string, version: string, confirmedAt: number | null): ReviewSource[] {
  const source = (id: string, kind: ReviewSource['kind'], data: Record<string, unknown>): ReviewSource => ({ id: `${origin}:${id}`, kind, origin, scope, version, confirmedAt, validFrom: null, validUntil: null, data });
  return [
    ...knowledge.products.map((product, index) => source(`product:${index}`, 'product', { ...product })),
    ...knowledge.faqs.filter(f => f.active).map((faq, index) => source(`faq:${index}`, 'faq', { ...faq })),
  ];
}

/** Select facts by the claims being checked; Content's input is only retained for traceability. */
export function selectReviewEvidence(drafts: GeneratedPostDraft[], catalog: ReviewSource[], scope: string, productIds: string[], contentInputHash: string, at = Date.now()): ReviewEvidence {
  const text = normalize(draftText(drafts));
  const price = /gia|\b\d|price|vnd|sale|giam/.test(text);
  const stock = /con hang|co san|het hang|so luong|ton kho|stock|available|chi con/.test(text);
  const policy = /ship|giao hang|doi tra|hoan|bao hanh|cod|van chuyen|mien phi/.test(text);
  const offer = /giam|sale|uu dai|voucher|tang|qua|freeship|combo|khuyen mai|discount/.test(text);
  const proof = /feedback|khach hang|chung nhan|danh gia|chung minh|review/.test(text);
  const selected = catalog.filter(source => source.scope === scope && (
    source.kind === 'product' ? productIds.includes(String(source.data.id))
      : source.kind === 'faq' ? policy && [source.data.question, source.data.tag, ...(Array.isArray(source.data.keywords) ? source.data.keywords : [])].some(term => {
        const words = normalize(String(term)).split(' ').filter(w => w.length >= 3 && !['chinh', 'sach', 'hang', 'shop', 'nhieu', 'cach', 'duoc', 'khong'].includes(w)); return words.some(word => ` ${text} `.includes(` ${word} `));
      }) : source.kind === 'offer' ? offer : source.kind === 'proof' ? proof : true
  ));
  const sources = selected.map(source => ({ ...source, data: source.kind === 'product'
    ? pick(source.data, ['id', 'sku', 'name', 'brand', 'description', 'features', 'benefits', 'usp', 'material', 'colors', 'sizes', 'limitations', 'careInstructions', ...(price ? ['price'] : []), ...(stock ? ['qty', 'stockKnown'] : [])])
    : source.kind === 'faq' ? pick(source.data, ['id', 'question', 'answer', 'tag']) : source.data }));
  return { scope, contentInputHash, sources, checkedAt: at, fingerprint: reviewHash(sources) };
}

export function evidenceConflicts(evidence: ReviewEvidence): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const products = evidence.sources.filter(s => s.kind === 'product');
  for (let i = 0; i < products.length; i++) for (let j = i + 1; j < products.length; j++) {
    const a = products[i], b = products[j];
    if (a.data.id !== b.data.id && a.data.sku !== b.data.sku) continue;
    for (const key of Object.keys(a.data)) {
      const x = a.data[key], y = b.data[key];
      if (x == null || y == null || x === '' || y === '' || (Array.isArray(x) && !x.length) || (Array.isArray(y) && !y.length)) continue;
      if (JSON.stringify(x) !== JSON.stringify(y)) issues.push(blockingIssue('conflict', `Nguồn sản phẩm ${a.data.sku} mâu thuẫn ở ${key}. Cập nhật/xác nhận dữ liệu trước khi Review.`, [a.id, b.id]));
    }
  }
  const faqs = evidence.sources.filter(source => source.kind === 'faq');
  for (let i = 0; i < faqs.length; i++) for (let j = i + 1; j < faqs.length; j++) {
    const a = faqs[i], b = faqs[j];
    if (normalize(String(a.data.question)) === normalize(String(b.data.question)) && normalize(String(a.data.answer)) !== normalize(String(b.data.answer))) issues.push(blockingIssue('conflict', `Chính sách "${a.data.question}" có câu trả lời mâu thuẫn; cần shop xác nhận.`, [a.id, b.id]));
  }
  return issues;
}

const urls = (text: string) => [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map(m => m[0].replace(/[.,;!?]+$/, ''));
export const reviewMoneyAmounts = (text: string) => [...text.matchAll(/\b(\d+(?:[.,]\d{3})*)\s*(?:đ|₫|vnd)(?=$|[^\p{L}\p{N}])/giu)].map(m => Number(m[1].replace(/[.,]/g, '')));
// shortcut: guards cover explicit VND amounts and SKU labels, use structured claims before promising full factual validation.
export function validateReviewedDraft(draft: GeneratedPostDraft, evidence: ReviewEvidence, channel: string): ReviewIssue[] {
  const issues = evidenceConflicts(evidence), text = draftText([draft]), normalized = normalize(text);
  const targetAt = evidence.targetAt ?? evidence.checkedAt;
  const facts = evidence.sources.map(source => JSON.stringify(source.data)).join('\n');
  const allowedUrls = new Set(urls(facts));
  if (urls(text).some(url => !allowedUrls.has(url))) issues.push(blockingIssue('scope', 'Bản sửa chứa URL ngoài căn cứ được phép.', [], 'content'));
  const allowedMoney = new Set([...reviewMoneyAmounts(facts), ...evidence.sources.filter(s => s.kind === 'product' && typeof s.data.price === 'number').map(s => Number(s.data.price))]);
  if (reviewMoneyAmounts(text).some(value => !allowedMoney.has(value))) issues.push(blockingIssue('unsupported_claim', 'Giá/chi phí trong bản sửa chưa có căn cứ phù hợp.', [], 'content'));
  const products = evidence.sources.filter(s => s.kind === 'product');
  if (/giam\s+\d|tang qua|combo\s+\d/.test(normalized) && !evidence.sources.some(s => s.kind === 'offer')) issues.push(blockingIssue('missing_source', 'Bản sửa thêm ưu đãi nhưng chưa có căn cứ chương trình để đối chiếu.', [], 'content'));
  const explicitSkus = [...text.matchAll(/\bSKU\s*[:：]\s*([\p{L}\p{N}_-]+)/giu)].map(m => m[1].toLowerCase());
  if (explicitSkus.some(sku => !products.some(s => String(s.data.sku).toLowerCase() === sku))) issues.push(blockingIssue('scope', 'Bản sửa nhắc SKU ngoài sản phẩm được chọn.', [], 'content'));
  if (/con hang|co san|chi con|san hang/.test(normalized) && products.some(p => !('qty' in p.data) || p.data.stockKnown === false || p.data.qty === 0)) issues.push(blockingIssue('unsupported_claim', 'Không xác nhận còn hàng/khan hiếm khi tồn chưa biết hoặc bằng 0.', products.map(p => p.id), 'content'));
  if (channel === 'tiktok' && draft.content.length > 150) issues.push(blockingIssue('format', 'Caption TikTok vượt 150 ký tự.', [], 'content'));
  if (channel === 'email' && draft.title.length > 60) issues.push(blockingIssue('format', 'Tiêu đề email vượt 60 ký tự.', [], 'title'));
  for (const source of evidence.sources.filter(s => s.kind === 'offer')) {
    if (source.data.kind !== 'none' && (source.data.confirmed !== true || (source.validFrom !== null && source.validFrom > targetAt) || (source.validUntil !== null && source.validUntil <= targetAt))) issues.push(blockingIssue('missing_source', 'Ưu đãi chưa được xác nhận hoặc không còn hiệu lực tại thời điểm dự kiến sử dụng.', [source.id], 'content'));
    if (source.data.kind === 'none' && /\bgiam\s+\d|voucher|ma giam|tang qua|combo\s+\d/.test(normalized)) issues.push(blockingIssue('unsupported_claim', 'Bản sửa tạo ưu đãi ngoài chương trình đã xác nhận.', [source.id], 'content'));
  }
  return issues;
}
