export interface Shop {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  logo: string | null; // data URL khi người dùng tự đổi ảnh, null = logo mặc định
}

export interface Plan {
  id: string;
  name: string;
  price: number; // VND / tháng
  quota: number; // số hội thoại / tháng
  features: string[];
}

export interface Subscription {
  planId: string;
  used: number;
  renewAt: string; // ISO date
}

export type MemberRole = 'owner' | 'staff';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: 'active' | 'pending';
}

export type ChannelId = 'messenger' | 'zalo' | 'tiktok';

export interface Channel {
  id: ChannelId;
  name: string;
  connected: boolean;
  enabled: boolean;
  account: string | null;
  comingSoon?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  material: string;
  emoji: string;
  category: string;
  colors: string[];
  sizes: string[];
  qty: number;
  price: number;
}

export interface ProductSource {
  name: string;
  connected: boolean;
  lastSyncedAt: number;
  syncCount: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  tag: string;
  keywords: string[];
  active: boolean;
}

export type TriggerKind = 'ask-no-order' | 'negative' | 'abandoned-cart' | 'inactive';

export interface EmailTrigger {
  id: TriggerKind;
  title: string;
  desc: string; // có thể chứa {delay}
  instant: boolean;
  enabled: boolean;
  delayValue: number;
  delayUnit: 'giờ' | 'ngày';
  subject: string;
  body: string;
}

export interface EmailLog {
  id: string;
  customer: string;
  triggerId: TriggerKind;
  summary: string;
  sentAt: number;
  status: 'sent' | 'opened';
}

export interface MockDb {
  version: number;
  shop: Shop;
  subscription: Subscription;
  members: Member[];
  channels: Channel[];
  productSource: ProductSource;
  products: Product[];
  faqs: Faq[];
  triggers: EmailTrigger[];
  emailLogs: EmailLog[];
}
