import { ApprovalItem, SegmentStat, RFMSegment } from '../types/marketing';

export const APPROVAL_ITEMS: ApprovalItem[] = [
  {
    id: '1',
    avatar: 'CL',
    name: 'Chị Lan',
    channel: '· Messenger',
    tag: '🔁 Cá nhân hóa theo hội thoại',
    tagType: 'loop',
    context: 'Trích từ hội thoại: "Áo này size L còn không shop, ship Hà Nội mấy ngày" — hỏi hôm qua, chưa chốt đơn',
    draft: 'Chị Lan ơi, áo mà chị hỏi hôm qua (size L) đang còn hàng nè 🎉 Ship về Hà Nội chỉ 1–2 ngày thôi ạ, mình để dành hàng cho chị tới hết hôm nay nha!',
    time: '2 giờ trước',
  },
  {
    id: '2',
    avatar: 'KD',
    name: 'Khánh D.',
    channel: '· Zalo OA',
    tag: '🔁 Cá nhân hóa theo hội thoại',
    tagType: 'loop',
    context: 'Trích từ hội thoại: "Áo dài tay có sẵn màu đen không ạ?" — hỏi 3 giờ trước, chưa chốt đơn',
    draft: 'Dạ anh Khánh ơi, áo dài tay màu đen anh hỏi vẫn còn hàng ạ, còn size M và L thôi nên anh chốt sớm giúp shop nha 🖤',
    time: '40 phút trước',
  },
  {
    id: '3',
    avatar: '24',
    avatarStyle: { background: 'var(--amber-soft)', color: 'var(--amber)' },
    name: 'Nhóm "Sắp rời bỏ"',
    channel: '· 24 khách hàng',
    tag: '📊 Theo hành vi (RFM)',
    tagType: 'rfm',
    context: 'Không có hội thoại gần đây — remarketing theo cohort hành vi mua hàng (giống Klaviyo)',
    draft: 'Lâu rồi không thấy bạn ghé shop 🥺 Ưu đãi 15% dành riêng cho bạn, áp dụng đến hết tuần này!',
    time: 'Hôm qua',
  },
];

export const SEGMENT_STATS: SegmentStat[] = [
  { id: 'vip', label: '⭐ VIP', value: 86, sub: 'Mua ≥ 5 lần / 90 ngày' },
  { id: 'loyal', label: '💚 Trung thành', value: 214, sub: 'Mua đều đặn, chưa VIP' },
  { id: 'risk', label: '⚠️ Sắp rời bỏ', value: 57, sub: 'Không quay lại > 45 ngày' },
  { id: 'new', label: '🆕 Mới', value: 132, sub: 'Mới tương tác/mua lần đầu' },
];

export const CHIP_FILTERS = [
  'Tất cả',
  'Đã hỏi sản phẩm cụ thể',
  'Đã phàn nàn/khiếu nại',
  'Chưa từng chat',
];

export const RFM_SEGMENTS: RFMSegment[] = [
  { name: 'VIP', count: 86, percentage: 18, color: 'var(--amber)', dotClass: 'seg-vip' },
  { name: 'Trung thành', count: 214, percentage: 44, color: 'var(--moss)', dotClass: 'seg-loyal' },
  { name: 'Sắp rời bỏ', count: 57, percentage: 12, color: 'var(--coral)', dotClass: 'seg-risk' },
  { name: 'Mới', count: 132, percentage: 27, color: '#8FA7C7', dotClass: 'seg-new' },
];
