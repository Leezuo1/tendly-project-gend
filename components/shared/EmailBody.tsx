import { renderBody, type TemplateContext } from '@/lib/services/emailTemplate';
import { formatMoney } from '@/lib/utils/format';

/** Phần thân email (đoạn văn + thẻ sản phẩm) — dùng chung cho admin xem mẫu và hộp thư khách */
export function EmailBody({ body, ctx }: { body: string; ctx: TemplateContext }) {
  return (
    <>
      {renderBody(body, ctx).map((block, i) =>
        block.type === 'p' ? (
          <p key={i}>{block.text}</p>
        ) : ctx.product ? (
          <div key={i} className="product-card">
            <div className="product-thumb">{ctx.product.emoji}</div>
            <div className="product-info">
              <div className="p-name">{ctx.san_pham} — Size {ctx.size}, màu {ctx.mau}</div>
              <div className="p-attr">Ship về {ctx.khu_vuc}: 1–2 ngày làm việc</div>
              <div className="p-price">{formatMoney(ctx.product.price)}</div>
            </div>
          </div>
        ) : null,
      )}
    </>
  );
}
