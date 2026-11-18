/** Chọn ảnh sản phẩm gửi kèm câu trả lời: hàm thuần, không đụng database. */
import type { PhotoCandidate } from '@/lib/services/productImages';

// Giữ dấu tiếng Việt: bỏ dấu thì tên như "Quần" hay "Đầm" khớp nhầm vào "quan tâm", "đảm bảo".
const lower = (text: string) => text.normalize('NFC').toLowerCase().trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Khớp nguyên từ, không khớp giữa một từ/mã dài hơn (AT-01 không khớp trong AT-012).
const hasWord = (text: string, phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(text);
const MIN_PHRASE = 3;

/**
 * Chỉ giữ sản phẩm model đã chọn VÀ có trong danh sách ứng viên VÀ được chính câu trả lời nhắc tên (hoặc SKU), nguyên từ, tối thiểu 3 ký tự.
 * Lời nhắc dặn model nhắc đúng tên; đây là chặn cứng, không tin model.
 * Giới hạn: chỉ chứng minh câu trả lời nhắc tới sản phẩm; "khách có thật sự cần xem ảnh" (không phải hỏi giá/tồn kho/size) chỉ do lời nhắc đảm bảo.
 * shortcut: model diễn đạt tên khác danh mục thì khách chỉ nhận chữ; nới lỏng nếu gặp nhiều.
 */
export function keepNamedProducts(picked: string[], candidates: PhotoCandidate[], reply: string): PhotoCandidate[] {
  const text = lower(reply);
  const kept: PhotoCandidate[] = [];
  for (const id of picked) {
    const candidate = candidates.find((item) => item.productId === id);
    if (!candidate || kept.includes(candidate)) continue;
    const name = lower(candidate.name), sku = lower(candidate.sku);
    if ((name.length >= MIN_PHRASE && hasWord(text, name)) || (sku.length >= MIN_PHRASE && hasWord(text, sku))) kept.push(candidate);
  }
  return kept;
}

/** Xoay vòng: ảnh đầu của từng sản phẩm, rồi ảnh thứ hai..., tối đa `max` ảnh. */
export function photoImageIds(chosen: Pick<PhotoCandidate, 'imageIds'>[], max = 3): string[] {
  const ids: string[] = [];
  for (let round = 0; ids.length < max; round++) {
    let any = false;
    for (const product of chosen) {
      const id = product.imageIds[round];
      if (id === undefined) continue;
      any = true;
      if (ids.length < max) ids.push(id);
    }
    if (!any) break;
  }
  return ids;
}
