export interface SourcingProduct {
  name: string;
  keyword: string;
  signal: string;
  mentions: number;
  growth: number;
  channel: string;
  price: string;
  minOrder: string;
}

interface SourcingDemo {
  products: SourcingProduct[];
  suppliers: { name: string; location: string; leadTime: string; query: string }[];
}

// shortcut: tín hiệu và nhà cung cấp đều là dữ liệu mẫu, thay bằng nguồn đã xác minh khi triển khai thật.
export const sourcingDemos: Record<string, SourcingDemo> = {
  'Thời trang & phụ kiện': {
    products: [
      { name: 'Túi tote canvas', keyword: 'túi tote đi học', signal: 'Nội dung phối đồ đi học có nhiều câu hỏi về túi nhẹ, đựng vừa laptop.', mentions: 2400, growth: 68, channel: 'TikTok', price: '35.000–55.000đ / chiếc', minOrder: '30 chiếc', },
      { name: 'Áo thun form rộng', keyword: 'áo thun unisex', signal: 'Bình luận quan tâm chất cotton và bảng size cho cả nam lẫn nữ.', mentions: 1850, growth: 42, channel: 'Facebook', price: '45.000–70.000đ / áo', minOrder: '50 áo', },
      { name: 'Kẹp tóc hoa', keyword: 'kẹp tóc hoa', signal: 'Video hướng dẫn làm tóc gợi mở nhu cầu phụ kiện nhỏ, dễ mua kèm.', mentions: 1260, growth: 35, channel: 'Sàn TMĐT', price: '8.000–15.000đ / chiếc', minOrder: '100 chiếc', },
    ],
    suppliers: [
      { name: 'Xưởng thời trang trong nước', location: 'TP. Hồ Chí Minh', leadTime: '5–7 ngày', query: 'xưởng sản xuất giá sỉ' },
      { name: 'Đầu mối phụ kiện & may mặc', location: 'Hà Nội', leadTime: '3–5 ngày', query: 'đầu mối bán buôn' },
    ],
  },
  'Mỹ phẩm & làm đẹp': {
    products: [
      { name: 'Son dưỡng có màu', keyword: 'son dưỡng có màu', signal: 'Thảo luận chú ý lớp màu tự nhiên và khả năng dưỡng ẩm.', mentions: 3200, growth: 74, channel: 'TikTok', price: '35.000–65.000đ / thỏi', minOrder: '24 thỏi' },
      { name: 'Kem chống nắng dạng thỏi', keyword: 'chống nắng dạng thỏi', signal: 'Nhu cầu bôi lại nhanh và mang theo khi đi làm, đi học.', mentions: 2100, growth: 51, channel: 'Facebook', price: '80.000–130.000đ / thỏi', minOrder: '20 thỏi' },
      { name: 'Bông tẩy trang mềm', keyword: 'bông tẩy trang mềm', signal: 'Nội dung chăm da nhạy cảm nhắc đến phụ kiện ít xơ và tiện dụng.', mentions: 980, growth: 29, channel: 'Sàn TMĐT', price: '12.000–22.000đ / gói', minOrder: '50 gói' },
    ],
    suppliers: [
      { name: 'Nhà phân phối mỹ phẩm nội địa', location: 'TP. Hồ Chí Minh', leadTime: '2–4 ngày', query: 'nhà phân phối chính hãng bán sỉ' },
      { name: 'Đại lý mỹ phẩm & phụ kiện làm đẹp', location: 'Hà Nội', leadTime: '3–5 ngày', query: 'đại lý chính hãng giá sỉ' },
    ],
  },
  'Nhà cửa & đời sống': {
    products: [
      { name: 'Hộp đựng thực phẩm chia ngăn', keyword: 'hộp cơm chia ngăn', signal: 'Nội dung chuẩn bị cơm văn phòng tạo nhiều câu hỏi về đồ đựng tiện dụng.', mentions: 1900, growth: 62, channel: 'TikTok', price: '25.000–45.000đ / hộp', minOrder: '40 hộp' },
      { name: 'Kệ để bàn lắp ghép', keyword: 'góc làm việc gọn gàng', signal: 'Người xem tìm giải pháp sắp xếp bàn nhỏ và dễ tự lắp.', mentions: 1450, growth: 44, channel: 'Facebook', price: '60.000–95.000đ / kệ', minOrder: '20 kệ' },
      { name: 'Đèn ngủ cảm biến', keyword: 'đèn ngủ cảm biến', signal: 'Video sắp xếp phòng ngủ gợi mở nhu cầu đèn nhỏ, tự bật khi di chuyển.', mentions: 860, growth: 31, channel: 'Sàn TMĐT', price: '35.000–60.000đ / đèn', minOrder: '30 đèn' },
    ],
    suppliers: [
      { name: 'Đầu mối gia dụng nội địa', location: 'Bình Dương', leadTime: '3–5 ngày', query: 'nhà phân phối gia dụng giá sỉ' },
      { name: 'Xưởng đồ dùng nhà cửa', location: 'TP. Hồ Chí Minh', leadTime: '5–7 ngày', query: 'xưởng sản xuất bán buôn' },
    ],
  },
  'Thực phẩm & đồ uống': {
    products: [
      { name: 'Granola ít đường', keyword: 'bữa sáng granola', signal: 'Người dùng trao đổi về bữa sáng nhanh và thành phần ít đường.', mentions: 2200, growth: 57, channel: 'TikTok', price: '30.000–45.000đ / túi', minOrder: '30 túi' },
      { name: 'Trà trái cây sấy', keyword: 'trà trái cây', signal: 'Nội dung pha đồ uống tại nhà thu hút câu hỏi về nguyên liệu và bảo quản.', mentions: 1580, growth: 46, channel: 'Facebook', price: '25.000–40.000đ / túi', minOrder: '40 túi' },
      { name: 'Hạt dinh dưỡng mix', keyword: 'hạt mix ăn vặt', signal: 'Các ý tưởng ăn vặt văn phòng nhắc nhiều đến gói nhỏ dễ mang theo.', mentions: 1140, growth: 33, channel: 'Sàn TMĐT', price: '35.000–55.000đ / hũ', minOrder: '24 hũ' },
    ],
    suppliers: [
      { name: 'Cơ sở chế biến thực phẩm', location: 'Đồng Nai', leadTime: '3–5 ngày', query: 'cơ sở sản xuất bán sỉ chứng nhận an toàn thực phẩm' },
      { name: 'Đầu mối nông sản & đồ uống', location: 'Lâm Đồng', leadTime: '4–6 ngày', query: 'nhà phân phối bán buôn nguồn gốc' },
    ],
  },
  'Điện tử & công nghệ': {
    products: [
      { name: 'Giá đỡ điện thoại gấp gọn', keyword: 'giá đỡ điện thoại', signal: 'Nội dung học online và quay video có nhu cầu phụ kiện điều chỉnh góc.', mentions: 2800, growth: 71, channel: 'TikTok', price: '20.000–40.000đ / chiếc', minOrder: '50 chiếc' },
      { name: 'Bàn phím không dây mini', keyword: 'bàn phím mini', signal: 'Các góc làm việc nhỏ thu hút câu hỏi về bàn phím gọn và ít dây.', mentions: 1650, growth: 48, channel: 'Facebook', price: '120.000–190.000đ / bộ', minOrder: '20 bộ' },
      { name: 'Hub USB-C đa cổng', keyword: 'hub usb c', signal: 'Thảo luận về laptop mỏng nhắc đến nhu cầu mở rộng cổng kết nối.', mentions: 1020, growth: 36, channel: 'Sàn TMĐT', price: '80.000–140.000đ / chiếc', minOrder: '20 chiếc' },
    ],
    suppliers: [
      { name: 'Nhà phân phối phụ kiện công nghệ', location: 'TP. Hồ Chí Minh', leadTime: '2–4 ngày', query: 'nhà phân phối giá sỉ bảo hành' },
      { name: 'Đầu mối thiết bị văn phòng', location: 'Hà Nội', leadTime: '3–5 ngày', query: 'đại lý bán buôn' },
    ],
  },
  'Dịch vụ': {
    products: [
      { name: 'Gói chụp ảnh sản phẩm', keyword: 'chụp ảnh sản phẩm', signal: 'Shop nhỏ tìm gói ảnh đơn giản để ra mắt danh mục mới.', mentions: 1300, growth: 53, channel: 'Facebook', price: '300.000–500.000đ / gói', minOrder: '1 gói' },
      { name: 'Gói thiết kế nội dung mạng xã hội', keyword: 'thiết kế bài đăng', signal: 'Thảo luận về bán hàng nhắc đến nhu cầu hình ảnh đồng bộ cho fanpage.', mentions: 970, growth: 38, channel: 'TikTok', price: '400.000–700.000đ / gói', minOrder: '1 gói' },
      { name: 'Gói đóng gói thuê', keyword: 'đóng gói đơn hàng', signal: 'Shop có chiến dịch ngắn hạn tìm đối tác hỗ trợ đóng gói linh hoạt.', mentions: 620, growth: 26, channel: 'Facebook', price: '3.000–6.000đ / đơn', minOrder: '100 đơn' },
    ],
    suppliers: [
      { name: 'Đối tác dịch vụ cho shop nhỏ', location: 'TP. Hồ Chí Minh', leadTime: '3–5 ngày', query: 'đơn vị cung cấp dịch vụ báo giá' },
      { name: 'Nhóm dịch vụ thương mại điện tử', location: 'Hà Nội', leadTime: '5–7 ngày', query: 'đối tác dịch vụ cho shop' },
    ],
  },
  'Khác': {
    products: [
      { name: 'Bộ hộp quà tối giản', keyword: 'hộp quà tối giản', signal: 'Tình huống mẫu: khách quan tâm hình thức đóng gói quà tặng.', mentions: 1100, growth: 45, channel: 'TikTok', price: '15.000–30.000đ / bộ', minOrder: '50 bộ' },
      { name: 'Túi giấy in thương hiệu', keyword: 'túi giấy shop', signal: 'Tình huống mẫu: shop tìm bao bì cá nhân hóa với số lượng nhỏ.', mentions: 820, growth: 32, channel: 'Facebook', price: '4.000–8.000đ / túi', minOrder: '100 túi' },
      { name: 'Thiệp cảm ơn cá nhân hóa', keyword: 'thiệp cảm ơn', signal: 'Tình huống mẫu: nội dung mở hộp nhắc đến lời nhắn từ shop.', mentions: 540, growth: 24, channel: 'Sàn TMĐT', price: '500–1.500đ / thiệp', minOrder: '200 thiệp' },
    ],
    suppliers: [
      { name: 'Xưởng bao bì & quà tặng', location: 'TP. Hồ Chí Minh', leadTime: '5–7 ngày', query: 'xưởng sản xuất giá sỉ' },
      { name: 'Đơn vị in ấn theo yêu cầu', location: 'Hà Nội', leadTime: '3–5 ngày', query: 'in theo yêu cầu số lượng ít' },
    ],
  },
};
