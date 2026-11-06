import type { PostReviewResult, ReviewField, ReviewSource } from '@/lib/types/postReview';

export const REVIEW_STATUS = { unchanged: 'Không cần sửa', corrected: 'Đã chỉnh sửa', needs_input: 'Cần bổ sung / xác nhận', blocked: 'Chưa thể sử dụng', failed: 'Review chưa hoàn tất', completed: 'Review hoàn tất', partial: 'Một phần cần xử lý' };
const FIELD: Record<ReviewField, string> = { title: 'Tiêu đề', content: 'Nội dung', hashtags: 'Hashtag', imageIdea: 'Mô tả ảnh / video', imagePrompt: 'Mô tả tạo ảnh' };
const KIND = { product: 'Sản phẩm', faq: 'FAQ / chính sách', brief: 'Brief / chấp thuận nguồn', voice: 'Giọng và quy tắc', offer: 'Ưu đãi', proof: 'Bằng chứng' };

function SourceFacts({ source }: { source: ReviewSource }) {
  const d = source.data;
  const text = (key: string) => typeof d[key] === 'string' ? d[key] as string : '';
  return <li>
    <b>{KIND[source.kind]}{d.sku ? ` · ${d.sku}` : ''}</b><span className="mw-muted"> · {source.origin === 'page-knowledge' ? 'Tri thức Page đã xác nhận' : source.origin === 'request-input' ? 'Dữ liệu đầu vào lần tạo' : 'Brief / dữ liệu chiến dịch đã duyệt'}</span>
    {text('name') && <p>{text('name')}</p>}
    {typeof d.price === 'number' && <p>Giá: {new Intl.NumberFormat('vi-VN').format(d.price)}đ</p>}
    {'qty' in d && <p>Tồn: {d.stockKnown === false ? 'Chưa xác nhận' : String(d.qty)}</p>}
    {['question', 'answer', 'material', 'description', 'limitations', 'message', 'cta', 'address', 'tone', 'avoid', 'details', 'conditions', 'proof', 'source'].filter(key => text(key)).map(key => <p key={key}>{text(key)}</p>)}
    {['features', 'benefits'].filter(key => Array.isArray(d[key]) && (d[key] as unknown[]).length).map(key => <p key={key}>{(d[key] as string[]).join(' · ')}</p>)}
    {d.approved === false && <p>Page chưa có bản tri thức được xác nhận bổ sung.</p>}
    <small className="mw-muted">{source.origin === 'campaign' ? `Phiên bản brief ${source.version.split(':').at(-1)}` : source.origin === 'page-knowledge' ? 'Bản tri thức Page' : 'Bản dữ liệu của lượt tạo'}{source.confirmedAt ? ` · xác nhận ${new Date(source.confirmedAt).toLocaleString('vi-VN')}` : ' · chưa xác nhận độc lập'}{source.validUntil ? ` · hết hiệu lực ${new Date(source.validUntil).toLocaleString('vi-VN')}` : ''}</small>
  </li>;
}

export function ReviewDetails({ review }: { review: PostReviewResult }) {
  return <details className="mw-comparison mw-review-details"><summary>Xem thay đổi và căn cứ Review</summary>
    <p className="mw-muted">{REVIEW_STATUS[review.status]} · {new Date(review.evidence.checkedAt).toLocaleString('vi-VN')} · {review.reviewModel === 'mock' ? 'Kênh mẫu · kiểm tra bằng quy tắc' : `Content: ${review.contentModel} · Review: ${review.reviewModel || 'chưa hoàn tất'}`}</p>
    {review.evidence.targetAt && <p className="mw-muted">Thời điểm dự kiến sử dụng: {new Date(review.evidence.targetAt).toLocaleString('vi-VN')}. Kiểm tra lại hiệu lực khi đăng / lập lịch.</p>}
    {review.variants.map((item, index) => <section key={item.draftId}>
      {review.variants.length > 1 && <h4>Phương án {index + 1} · {REVIEW_STATUS[item.status]}</h4>}
      {!!item.issues.length && <ul className="mw-review-issues">{item.issues.map((issue, i) => <li key={i}><b>{issue.severity === 'blocking' ? 'Cần xử lý' : 'Lưu ý'}:</b> {issue.message}</li>)}</ul>}
      {item.changes.map(change => <div key={change.field} className="mw-review-change"><h4>{FIELD[change.field]}</h4><div className="mw-review-diff"><div><b>Trước</b><p className="mw-copy">{change.before || '(Trống)'}</p></div><div><b>Sau</b><p className="mw-copy">{change.after || '(Đã bỏ)'}</p></div></div><p>{change.reason}</p>{!!change.sourceIds.length && <small className="mw-muted">Căn cứ: {change.sourceIds.map(id => { const source = review.evidence.sources.find(s => s.id === id); return source ? `${KIND[source.kind]} ${source.data.sku || source.data.question || ''}` : id; }).join(' · ')}</small>}</div>)}
      <details><summary>Xem bản ban đầu{item.finalDraft ? '' : ' (chưa có bản cuối hợp lệ)'}</summary><h4>{item.original.title}</h4><p className="mw-copy">{item.original.content}</p><p>{item.original.hashtags.join(' ')}</p><p className="mw-muted">{item.original.imageIdea}</p></details>
    </section>)}
    <details><summary>Căn cứ đã dùng ({review.evidence.sources.length})</summary><ul className="mw-review-sources">{review.evidence.sources.map(source => <SourceFacts key={source.id} source={source} />)}</ul></details>
    <p className="mw-muted">Review đối chiếu văn bản với các nguồn trên; ảnh/video đính kèm cần shop kiểm tra trước khi duyệt.</p>
  </details>;
}
