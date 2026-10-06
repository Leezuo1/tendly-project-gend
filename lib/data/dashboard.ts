import { UrgentItem } from '../types/dashboard';

export const INITIAL_URGENT_ITEMS: UrgentItem[] = [
  {
    id: 'u1',
    initials: 'PT',
    name: 'Phương T.',
    tag: 'Cảm xúc âm',
    msg: '"Đơn của em bị giao sai màu rồi, đây là lần thứ 2 luôn á..."',
    time: '6 phút',
    channel: 'Messenger (Facebook)',
    suggestedReply:
      'Dạ Tendly thay mặt shop chân thành xin lỗi chị Phương ạ! Shop sẽ gửi hoả tốc sản phẩm đúng màu và tặng kèm voucher 50k cho chị ngay trong chiều nay nhé ạ.',
  },
  {
    id: 'u2',
    initials: 'VH',
    name: 'Việt H.',
    tag: 'Cảm xúc âm',
    msg: '"Ship gì mà 5 ngày chưa tới, shop trả lời giúp em với"',
    time: '19 phút',
    channel: 'Zalo OA',
    suggestedReply:
      'Chào anh Việt, bên em vừa tra cứu mã vận đơn đơn hàng #TD-8821. Hiện kiện hàng đang tại bưu cục phát quận mình và sẽ giao trước 17h hôm nay ạ!',
  },
];

export const EMAIL_LOGS = [
  {
    icon: 'KD',
    name: 'Khánh D.',
    trigger: 'Hỏi chưa chốt đơn',
    status: 'Đã gửi',
  },
  {
    icon: 'HM',
    name: 'Hoài M.',
    trigger: 'Bỏ giỏ hàng',
    status: 'Đã mở',
  },
  {
    icon: 'NT',
    name: 'Ngọc T.',
    trigger: 'Hỏi chưa chốt đơn',
    status: 'Đã gửi',
  },
];

export const TOP_PRODUCTS = [
  {
    icon: '👕',
    name: 'Áo thun basic cotton Tendly',
    sku: 'SKU: AT-01',
    chatCount: 142,
    orderSignalCount: 38,
    rate: '26,8%',
  },
  {
    icon: '🧥',
    name: 'Áo khoác dạ nữ dáng dài AK-23',
    sku: 'SKU: AK-23',
    chatCount: 96,
    orderSignalCount: 29,
    rate: '30,2%',
  },
  {
    icon: '👗',
    name: 'Đầm voan hoa nhí cổ V vintage',
    sku: 'SKU: DV-12',
    chatCount: 84,
    orderSignalCount: 21,
    rate: '25,0%',
  },
  {
    icon: '👖',
    name: 'Quần jeans ống suông lưng cao QJ-88',
    sku: 'SKU: QJ-88',
    chatCount: 75,
    orderSignalCount: 18,
    rate: '24,0%',
  },
  {
    icon: '👚',
    name: 'Chân váy chữ A kaki túi hộp CV-05',
    sku: 'SKU: CV-05',
    chatCount: 52,
    orderSignalCount: 11,
    rate: '21,2%',
  },
];

export const WEEKLY_CHAT_STATS = [
  { day: 'T2', count: 32, height: '56%', isPeak: false },
  { day: 'T3', count: 41, height: '71%', isPeak: false },
  { day: 'T4', count: 38, height: '65%', isPeak: false },
  { day: 'T5', count: 52, height: '87%', isPeak: false },
  { day: 'T6', count: 61, height: '97%', isPeak: false },
  { day: 'T7', count: 74, height: '100%', isPeak: true },
  { day: 'CN', count: 45, height: '78%', isPeak: false },
];
