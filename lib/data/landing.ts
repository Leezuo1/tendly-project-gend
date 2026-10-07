import { Brand, Stat, Step, FeatureCard, BentoItem, ConversationRow } from '../types/landing';

export const HERO_CONVERSATIONS: ConversationRow[] = [
  {
    initials: 'TN',
    bg: '#FCE4E2',
    color: 'var(--coral-deep)',
    name: 'Trang N.',
    tag: 'Cảm xúc âm',
    tagClass: 'tag-high',
    msg: 'Đơn của mình 4 ngày chưa thấy giao, shop check giúp gấp ạ!',
    dotColor: '#1877F2',
    channel: 'Facebook · 2 phút trước',
  },
  {
    initials: 'KD',
    bg: 'var(--moss-soft)',
    color: 'var(--moss)',
    name: 'Khánh D.',
    tag: 'Khách quay lại',
    tagClass: 'tag-return',
    msg: 'Áo polo đợt trước mặc thích lắm, shop còn màu xám size L không?',
    dotColor: '#FF0050',
    channel: 'TikTok · 14 phút trước',
  },
  {
    initials: 'LP',
    bg: 'var(--sand)',
    color: 'var(--ink-soft)',
    name: 'Linh P.',
    tag: 'Khách mới',
    tagClass: 'tag-new',
    msg: 'Shop có ship hoả tốc quận 1 trong chiều nay được không ạ?',
    dotColor: '#0068FF',
    channel: 'Zalo · 28 phút trước',
  },
];

export const BRANDS: Brand[] = [
  { letter: 'f', name: 'Facebook', bg: '#1877F2' },
  { letter: '♪', name: 'TikTok Shop', bg: '#000000' },
  { letter: 'Z', name: 'Zalo OA', bg: '#0068FF' },
  { letter: 'L', name: 'Lazada', bg: '#0F146D' },
  { letter: 'G', name: 'GrabExpress', bg: '#00B14F' },
  { letter: 'M', name: 'MoMo', bg: '#A50064' },
];

export const STATS: Stat[] = [
  { num: '3.500+', label: 'Shop đang dùng', target: 3500 },
  { num: '98%', label: '% hội thoại được AI xử lý', target: 98 },
  { num: '45', label: 'giây phản hồi trung bình', target: 45 },
  { num: '3', label: 'kênh tích hợp sẵn', target: 3 },
];

export const STEPS: Step[] = [
  {
    num: 'BƯỚC 01',
    title: 'Kết nối kênh & nhập sản phẩm',
    body: 'Liên kết Facebook, TikTok, Zalo chỉ với vài click. Upload danh mục sản phẩm qua file Excel/CSV hoặc nhập tay để AI nắm rõ thông tin tồn kho và giá cả.',
  },
  {
    num: 'BƯỚC 02',
    title: 'AI tự phân loại & trả lời',
    body: 'AI tự động giải đáp câu hỏi thường gặp về giá, size, phí ship. Nhận diện khách hàng có cảm xúc tiêu cực để đẩy lên đầu hàng đợi và chuyển nhân viên xử lý kịp thời.',
  },
  {
    num: 'BƯỚC 03',
    title: 'Email cá nhân hoá & đo hiệu quả',
    body: 'Tự động gửi email chăm sóc lại theo kịch bản thông minh (khách hỏi chưa chốt, gửi voucher xoa dịu). Đo lường tỷ lệ phản hồi trực tiếp trên bảng điều khiển.',
  },
];

export const SIDE_FEATURE_CARDS: FeatureCard[] = [
  {
    icon: '🤖',
    iconBg: '#FCE4E2',
    title: 'Cấu hình AI dễ dàng',
    body: 'Upload file Excel/CSV hoặc nhập tay dữ liệu sản phẩm, thêm câu hỏi thường gặp — AI tự học và trả lời khách chính xác theo thông tin shop.',
  },
  {
    icon: '✉️',
    iconBg: 'var(--moss-soft)',
    title: 'Email cá nhân hoá tự động',
    body: 'AI soạn email dựa trên hội thoại thực tế — đúng sản phẩm khách hỏi, đúng ngữ cảnh. Bạn chỉ cần duyệt hoặc để hệ thống tự gửi.',
  },
];

export const BENTO_ITEMS: BentoItem[] = [
  {
    icon: '📊',
    iconBg: 'var(--coral)',
    iconColor: 'white',
    tag: 'Dashboard',
    tagBg: '#FCE4E2',
    tagColor: 'var(--coral-deep)',
    title: 'Tổng quan thời gian thực',
    body: 'Xem ngay hội thoại đang chờ, ca cần xử lý gấp (cảm xúc âm), email đã gửi hôm nay và đơn ước tính qua chat — tất cả trên 1 dashboard.',
  },
  {
    icon: '🔗',
    iconBg: 'var(--moss-soft)',
    span: 2,
    tag: 'Đa kênh',
    tagBg: 'var(--moss-soft)',
    tagColor: 'var(--moss)',
    title: 'Tích hợp 3 kênh bán hàng',
    body: 'Facebook Page, TikTok Shop, Zalo OA — kết nối trong 2 phút, mọi tin nhắn và bình luận tự chảy về 1 hộp thư. Không cần mở nhiều tab, không sót khách.',
  },
  {
    icon: '😤',
    iconBg: 'var(--sand)',
    tag: 'AI',
    tagBg: 'var(--sand)',
    tagColor: 'var(--ink-soft)',
    title: 'Phân tích cảm xúc',
    body: 'AI tự nhận diện hội thoại có cảm xúc tiêu cực. Khách không hài lòng sẽ được đánh dấu "cần xử lý gấp" và tự chuyển sang nhân viên.',
  },
  {
    icon: '📋',
    iconBg: '#E7DED7',
    title: 'Quản lý sản phẩm & FAQ',
    body: 'Import danh mục sản phẩm bằng file Excel/CSV hoặc nhập tay. Thêm câu hỏi thường gặp để AI trả lời chính xác thay bạn.',
  },
  {
    icon: '📈',
    iconBg: '#FCE4E2',
    title: 'Báo cáo chi tiết',
    body: 'Theo dõi tỷ lệ phản hồi sau email, thời gian phản hồi trung bình, số ca đã xoa dịu và tỷ lệ mở email — với biểu đồ trực quan theo ngày.',
  },
];

export const DETAIL_INBOX_ITEMS = [
  { initials: 'Tr', bg: '#1877F2', name: 'Trang N.', src: 'Facebook', preview: '"Ib giá áo khoác size M, mình để lại sđt..."', time: '2 phút', badge: true },
  { initials: 'Kh', bg: '#FF0050', name: 'Khánh D.', src: 'TikTok', preview: '"Còn màu đen không bạn ơi? Có ship COD..."', time: '15 phút', badge: true },
  { initials: 'Li', bg: '#0068FF', name: 'Linh P.', src: 'Zalo OA', preview: '"Check giúp mình đơn hàng giao đến đâu rồi nha"', time: '45 phút', badge: false },
];
