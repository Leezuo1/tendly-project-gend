import type { MockDb, Plan, Product } from '../types';

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Gói Khởi Đầu',
    price: 0,
    quota: 300,
    features: ['1 kênh kết nối', 'Trả lời tự động cơ bản', '1 nhân viên'],
  },
  {
    id: 'growth',
    name: 'Gói Tăng Trưởng',
    price: 399000,
    quota: 2000,
    features: ['3 kênh kết nối', 'Email cá nhân hoá', 'Tối đa 5 nhân viên'],
  },
  {
    id: 'pro',
    name: 'Gói Chuyên Nghiệp',
    price: 899000,
    quota: 6000,
    features: ['Không giới hạn kênh', 'Phân tích cảm xúc nâng cao', 'Không giới hạn nhân viên'],
  },
];

export const TIMEZONES = ['GMT+7 — Hà Nội, TP.HCM', 'GMT+8 — Singapore'];

/** Sản phẩm mới xuất hiện ở lần đồng bộ Shopee đầu tiên — để demo việc đồng bộ có thay đổi dữ liệu */
export const SHOPEE_NEW_PRODUCT: Product = {
  id: 'p-at15', sku: 'AT-15', name: 'Áo baby tee cổ vuông AT-15', material: 'Cotton tăm co giãn',
  emoji: '👕', category: 'Áo thun', colors: ['Trắng', 'Hồng phấn'], sizes: ['S', 'M'], qty: 64, price: 199000,
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export function createSeed(): MockDb {
  const now = Date.now();
  return {
    version: 1,
    shop: {
      name: 'Tendly',
      email: 'hi@tendly.vn',
      phone: '090 123 4567',
      timezone: TIMEZONES[0],
      logo: null,
    },
    subscription: { planId: 'growth', used: 1240, renewAt: '2026-10-15' },
    members: [
      { id: 'm1', name: 'Thảo Nguyễn', email: 'thao@tendly.vn', role: 'owner', status: 'active' },
      { id: 'm2', name: 'Minh Anh', email: 'minhanh@tendly.vn', role: 'staff', status: 'active' },
      { id: 'm3', name: 'Duyên', email: 'duyen@tendly.vn', role: 'staff', status: 'pending' },
    ],
    channels: [
      { id: 'messenger', name: 'Messenger', connected: true, enabled: true, account: 'Fanpage Tendly' },
      { id: 'zalo', name: 'Zalo OA', connected: false, enabled: false, account: null },
      { id: 'tiktok', name: 'TikTok Shop', connected: false, enabled: false, account: null, comingSoon: true },
    ],
    productSource: {
      name: 'Gian hàng Shopee chính hãng — Tendly Store',
      connected: true,
      lastSyncedAt: now - 2 * HOUR,
      syncCount: 0,
    },
    products: [
      { id: 'p-at01', sku: 'AT-01', name: 'Áo thun basic cotton Tendly', material: '100% Cotton Compact', emoji: '👕', category: 'Áo thun', colors: ['Trắng', 'Đen', 'Xám'], sizes: ['S', 'M', 'L', 'XL'], qty: 145, price: 259000 },
      { id: 'p-ak23', sku: 'AK-23', name: 'Áo khoác dạ nữ dáng dài AK-23', material: 'Dạ ép 2 lớp cao cấp', emoji: '🧥', category: 'Áo khoác', colors: ['Be', 'Nâu tây', 'Đen'], sizes: ['S', 'M'], qty: 42, price: 1290000 },
      { id: 'p-dv12', sku: 'DV-12', name: 'Đầm voan hoa nhí cổ V vintage', material: 'Voan tơ lót lụa habutai', emoji: '👗', category: 'Váy & Đầm', colors: ['Vàng pastel', 'Xanh mint'], sizes: ['Freesize'], qty: 68, price: 459000 },
      { id: 'p-qj88', sku: 'QJ-88', name: 'Quần jeans ống suông lưng cao QJ-88', material: 'Denim co giãn nhẹ', emoji: '👖', category: 'Quần jeans', colors: ['Xanh khói', 'Xanh đen'], sizes: ['26', '27', '28', '29'], qty: 55, price: 499000 },
      { id: 'p-cv05', sku: 'CV-05', name: 'Chân váy chữ A kaki túi hộp CV-05', material: 'Kaki chéo dày dặn', emoji: '👚', category: 'Chân váy', colors: ['Be sáng', 'Đen'], sizes: ['S', 'M'], qty: 12, price: 329000 },
      { id: 'p-sm09', sku: 'SM-09', name: 'Áo sơ mi lụa satin công sở SM-09', material: 'Lụa ngọc trai mềm mát', emoji: '👔', category: 'Áo sơ mi', colors: ['Trắng kem', 'Hồng phấn'], sizes: ['M', 'L'], qty: 89, price: 389000 },
      { id: 'p-pk03', sku: 'PK-03', name: 'Túi tote vải canvas in chữ Tendly', material: 'Canvas dệt sợi đôi', emoji: '👜', category: 'Phụ kiện', colors: ['Trắng ngà', 'Đen'], sizes: ['One size'], qty: 180, price: 159000 },
      { id: 'p-at02', sku: 'AT-02', name: 'Áo thun oversize in chữ Tendly', material: 'Cotton 2 chiều 250gsm', emoji: '👕', category: 'Áo thun', colors: ['Trắng', 'Đen', 'Be'], sizes: ['M', 'L', 'XL'], qty: 96, price: 289000 },
      { id: 'p-at07', sku: 'AT-07', name: 'Áo polo nữ dệt kim AT-07', material: 'Cotton pique thoáng khí', emoji: '👕', category: 'Áo thun', colors: ['Trắng', 'Xanh navy'], sizes: ['S', 'M', 'L'], qty: 8, price: 319000 },
      { id: 'p-ak11', sku: 'AK-11', name: 'Áo khoác jean wash bụi AK-11', material: 'Denim 100% cotton', emoji: '🧥', category: 'Áo khoác', colors: ['Xanh nhạt'], sizes: ['M', 'L'], qty: 27, price: 559000 },
      { id: 'p-ak15', sku: 'AK-15', name: 'Áo cardigan len mỏng AK-15', material: 'Len lông cừu pha', emoji: '🧶', category: 'Áo khoác', colors: ['Kem', 'Xám tro', 'Nâu'], sizes: ['Freesize'], qty: 0, price: 429000 },
      { id: 'p-dv20', sku: 'DV-20', name: 'Đầm suông linen cổ tròn DV-20', material: 'Linen bột mềm', emoji: '👗', category: 'Váy & Đầm', colors: ['Trắng', 'Be', 'Xanh rêu'], sizes: ['S', 'M', 'L'], qty: 34, price: 489000 },
      { id: 'p-dv31', sku: 'DV-31', name: 'Đầm dự tiệc satin hai dây DV-31', material: 'Satin lụa Hàn', emoji: '👗', category: 'Váy & Đầm', colors: ['Đen', 'Đỏ rượu'], sizes: ['S', 'M'], qty: 15, price: 690000 },
      { id: 'p-qj41', sku: 'QJ-41', name: 'Quần jeans skinny QJ-41', material: 'Denim cotton spandex', emoji: '👖', category: 'Quần jeans', colors: ['Đen', 'Xanh đậm'], sizes: ['26', '27', '28', '29', '30'], qty: 73, price: 459000 },
      { id: 'p-qt02', sku: 'QT-02', name: 'Quần tây ống đứng công sở QT-02', material: 'Tuyết mưa Hàn', emoji: '👖', category: 'Quần tây', colors: ['Đen', 'Be', 'Ghi'], sizes: ['S', 'M', 'L'], qty: 61, price: 399000 },
      { id: 'p-qs08', sku: 'QS-08', name: 'Quần short kaki QS-08', material: 'Kaki cotton', emoji: '🩳', category: 'Quần short', colors: ['Be', 'Đen', 'Trắng'], sizes: ['S', 'M', 'L'], qty: 110, price: 229000 },
      { id: 'p-cv12', sku: 'CV-12', name: 'Chân váy xếp ly dài CV-12', material: 'Voan chiffon 2 lớp', emoji: '👚', category: 'Chân váy', colors: ['Đen', 'Kem', 'Xanh dương'], sizes: ['Freesize'], qty: 47, price: 359000 },
      { id: 'p-sm14', sku: 'SM-14', name: 'Áo sơ mi kẻ sọc form rộng SM-14', material: 'Cotton lụa', emoji: '👔', category: 'Áo sơ mi', colors: ['Xanh sọc trắng', 'Hồng sọc trắng'], sizes: ['Freesize'], qty: 19, price: 349000 },
      { id: 'p-pk07', sku: 'PK-07', name: 'Mũ bucket vải dù PK-07', material: 'Vải dù chống nước', emoji: '🧢', category: 'Phụ kiện', colors: ['Đen', 'Be', 'Xanh rêu'], sizes: ['One size'], qty: 140, price: 129000 },
      { id: 'p-pk11', sku: 'PK-11', name: 'Thắt lưng da khoá tròn PK-11', material: 'Da bò thật', emoji: '👝', category: 'Phụ kiện', colors: ['Đen', 'Nâu'], sizes: ['One size'], qty: 38, price: 249000 },
    ],
    faqs: [
      {
        id: 'f1', question: 'Shop có giao COD không?', tag: 'Giao hàng & Thanh toán', active: true,
        keywords: ['COD', 'thanh toán khi nhận', 'trả tiền khi nhận', 'nhận hàng rồi trả tiền'],
        answer: 'Có, áp dụng toàn quốc. Phí COD tính theo khu vực, hiển thị rõ ràng khi khách đặt hàng. Khách được kiểm tra ngoại quan gói hàng trước khi thanh toán.',
      },
      {
        id: 'f2', question: 'Đổi trả trong bao lâu?', tag: 'Đổi trả & Hoàn tiền', active: true,
        keywords: ['đổi trả', 'đổi hàng', 'trả hàng', 'đổi size'],
        answer: 'Đổi trả miễn phí trong 7 ngày nếu sản phẩm còn nguyên tem mác, chưa qua sử dụng. Shop hỗ trợ đổi size tận nhà, shipper mang size mới đến lấy size cũ về.',
      },
      {
        id: 'f3', question: 'Thời gian giao hàng bao lâu?', tag: 'Vận chuyển', active: true,
        keywords: ['bao lâu', 'mấy ngày', 'thời gian giao', 'ship về', 'giao về', 'khi nào nhận'],
        answer: 'Nội thành TP.HCM và Hà Nội: 1–2 ngày làm việc. Các tỉnh thành khác: 2–4 ngày làm việc. Hỗ trợ giao hỏa tốc 2H trong nội thành nếu khách cần gấp.',
      },
      {
        id: 'f4', question: 'Phí vận chuyển được tính như thế nào?', tag: 'Vận chuyển', active: true,
        keywords: ['phí ship', 'phí vận chuyển', 'freeship', 'miễn phí ship', 'tiền ship'],
        answer: 'Miễn phí vận chuyển toàn quốc cho đơn từ 300.000đ. Với đơn dưới 300.000đ, phí ship đồng giá 25.000đ cho nội thành và 35.000đ cho liên tỉnh.',
      },
      {
        id: 'f5', question: 'Chất liệu sản phẩm có bị xù lông hay phai màu khi giặt không?', tag: 'Sản phẩm & Bảo quản', active: true,
        keywords: ['xù lông', 'phai màu', 'giặt', 'bảo quản', 'co rút', 'ra màu'],
        answer: 'Tất cả sản phẩm của Tendly được xử lý chống co rút và bền màu trước khi xuất xưởng. Nên giặt ở nhiệt độ thường và tránh phơi trực tiếp dưới nắng gắt để giữ độ bền form dáng tốt nhất.',
      },
    ],
    triggers: [
      {
        id: 'ask-no-order', title: 'Hỏi nhưng chưa chốt đơn', instant: false, enabled: true, delayValue: 24, delayUnit: 'giờ',
        desc: 'Gửi sau {delay} nếu khách hỏi sản phẩm nhưng không đặt hàng — nhắc đúng nội dung đã hỏi (size, khu vực, sản phẩm).',
        subject: '{san_pham} size {size} {ten_khach} hỏi hôm qua vẫn còn nè 🎉',
        body: 'Chào {ten_khach},\n\nHôm qua {ten_khach} có nhắn hỏi shop về {san_pham} size {size} và thời gian giao hàng về {khu_vuc} — mình xin phép nhắc lại để tiện chốt đơn nha, hàng sắp hết size {size} rồi ạ 🥰\n\n{the_san_pham}\n\nMình để dành hàng đến hết hôm nay thôi ạ, chốt sớm để không lỡ mất size mình cần nha!',
      },
      {
        id: 'negative', title: 'Khách đang bực (cảm xúc âm)', instant: true, enabled: true, delayValue: 0, delayUnit: 'giờ',
        desc: 'Gửi ngay khi AI phát hiện sentiment tiêu cực trong hội thoại, kèm voucher xin lỗi đã cấu hình.',
        subject: 'Tendly xin lỗi {ten_khach} vì trải nghiệm chưa tốt 🙏',
        body: 'Chào {ten_khach},\n\nTendly rất tiếc vì đơn {ma_don} chưa làm {ten_khach} hài lòng. Nhân viên của shop đang xử lý trực tiếp và sẽ cập nhật cho {ten_khach} sớm nhất.\n\nGửi {ten_khach} mã giảm giá {voucher} (giảm 10% cho đơn tiếp theo) như một lời xin lỗi chân thành từ shop.\n\nCảm ơn {ten_khach} đã kiên nhẫn cùng Tendly!',
      },
      {
        id: 'abandoned-cart', title: 'Bỏ giỏ hàng', instant: false, enabled: true, delayValue: 3, delayUnit: 'giờ',
        desc: 'Gửi sau {delay} nếu khách thêm sản phẩm vào giỏ nhưng chưa thanh toán.',
        subject: '{ten_khach} ơi, giỏ hàng của mình vẫn đang chờ nè 🛒',
        body: 'Chào {ten_khach},\n\nMình thấy {ten_khach} còn để {san_pham} (size {size}, màu {mau}) trong giỏ hàng nè.\n\n{the_san_pham}\n\nHoàn tất đơn trong hôm nay để được freeship cho đơn từ 300.000đ nha!',
      },
      {
        id: 'inactive', title: 'Khách lâu chưa quay lại', instant: false, enabled: false, delayValue: 30, delayUnit: 'ngày',
        desc: 'Gửi sau {delay} khách không có hoạt động mua sắm hoặc trò chuyện nào.',
        subject: 'Lâu rồi không gặp, {ten_khach} ơi 💕',
        body: 'Chào {ten_khach},\n\nĐã lâu Tendly chưa được phục vụ {ten_khach}. Shop vừa về nhiều mẫu mới, gửi {ten_khach} mã {voucher} để quay lại mua sắm nha.\n\nHẹn gặp lại {ten_khach} sớm!',
      },
    ],
    emailLogs: [
      { id: 'l1', customer: 'Khánh D.', triggerId: 'ask-no-order', summary: 'nhắc size L, ship Hà Nội', sentAt: now - 10 * MIN, status: 'sent' },
      { id: 'l2', customer: 'Phương T.', triggerId: 'negative', summary: 'voucher xin lỗi 10%', sentAt: now - 42 * MIN, status: 'opened' },
      { id: 'l3', customer: 'Hoài M.', triggerId: 'abandoned-cart', summary: 'áo khoác dạ AK-23', sentAt: now - 1 * HOUR, status: 'sent' },
    ],
  };
}
