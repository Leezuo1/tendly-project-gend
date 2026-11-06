import type { CareSourceContext } from '@/lib/types/customerCare';

export function ConversationSources({ context }: { context?: CareSourceContext }) {
  if (!context?.sources.length) return null;
  const uncertain = context.resolution === 'ambiguous' || context.resolution === 'unresolved';
  return <section className="thread-sources" aria-label="Nguồn ngữ cảnh hội thoại">
    <h3>Nguồn hội thoại</h3>
    <p role="status">{uncertain ? 'Chưa rõ khách đang hỏi nguồn nào · Cần hỏi lại'
      : context.blocked ? 'Nguồn cần kiểm tra · Tự trả lời đang bị chặn'
      : context.resolution === 'reply' ? 'Khách trả lời trực tiếp tin nhắn từ nguồn này' : 'Đã liên kết qua tin nhắn riêng'}</p>
    <details><summary>Xem bài đăng, sản phẩm & ưu đãi liên quan</summary>
      {context.sources.map(source => <article key={source.id}>
        <strong>{source.live ? `${source.live.sourceKind === 'live_video' ? 'Livestream' : 'Phiên bán hàng'} · ${source.live.title}`
          : source.campaign?.name || 'Bài đăng Facebook'}{source.id === context.selectedId && ' · Nguồn đang đối chiếu'}</strong>
        <p>Liên kết lúc {new Date(source.linkedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
        {source.commentText && <blockquote>{source.commentText}</blockquote>}
        {source.postText && <p>{source.postText}</p>}
        {source.products.length > 0 && <p>Sản phẩm: {source.products.map(product => `${product.sku} · ${product.name}`).join(', ')}</p>}
        {source.campaign?.offer && <p>Ưu đãi trong bài: {source.campaign.offer.details} · {source.campaign.offerActive ? 'Còn hiệu lực' : 'Cần xác nhận lại'}<br />Điều kiện: {source.campaign.offer.conditions}<br />Hiệu lực đến {new Date(source.campaign.offer.endsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
        {source.live && <p>{source.live.status === 'ended' ? 'Phiên đã kết thúc' : 'Phiên đang mở'}{source.live.flashPrice !== null && ` · Giá trong phiên lúc nhắn riêng: ${source.live.flashPrice.toLocaleString('vi-VN')} đ · ${source.live.flashActive ? 'Còn hiệu lực' : 'Cần xác nhận lại'}`}</p>}
        {source.issues.length > 0 && <ul>{source.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {source.postId && /^\d{1,64}_\d{1,64}$/.test(source.postId) && <a href={`https://www.facebook.com/${source.postId}`} target="_blank" rel="noopener noreferrer">Mở bài gốc trên Facebook</a>}
      </article>)}
    </details>
  </section>;
}
