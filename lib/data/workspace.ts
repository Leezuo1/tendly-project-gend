import type { WorkspaceAvatar, WorkspaceTone } from '@/lib/services/mockOnboarding';

export const industries = ['Thời trang & phụ kiện', 'Mỹ phẩm & làm đẹp', 'Nhà cửa & đời sống', 'Thực phẩm & đồ uống', 'Điện tử & công nghệ', 'Dịch vụ', 'Khác'];
export const avatarOptions: { value: WorkspaceAvatar; label: string; symbol: string }[] = [
  { value: 'initial', label: 'Chữ cái tên shop', symbol: 'A' },
  { value: 'flower', label: 'Bông hoa', symbol: '✳' },
  { value: 'heart', label: 'Trái tim', symbol: '♡' },
  { value: 'shop', label: 'Ngôi nhà', symbol: '⌂' },
];
export const toneOptions: { value: WorkspaceTone; label: string }[] = [
  { value: 'coral', label: 'San hô nhạt' }, { value: 'sage', label: 'Xanh rêu nhạt' }, { value: 'sand', label: 'Kem cát' },
];
