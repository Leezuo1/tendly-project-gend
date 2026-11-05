'use client';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { ChannelsTab } from './ChannelsTab';
import { PlanCard } from './PlanCard';
import { ShopInfoCard } from './ShopInfoCard';
import { TeamCard } from './TeamCard';
import { ProductsTab } from '@/components/features/ai-config/ProductsTab';
import { FaqTab } from '@/components/features/ai-config/FaqTab';
import { EmailTab } from '@/components/features/ai-config/EmailTab';

const TABS = [
  { key: 'account', label: 'Tài khoản & nhân viên' }, { key: 'channels', label: 'Tích hợp kênh' },
  { key: 'products', label: 'Nguồn sản phẩm' }, { key: 'faq', label: 'FAQ' }, { key: 'email', label: 'Email tự động' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
export function SettingsShell() {
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'account');
  const content = { account: <><ShopInfoCard /><PlanCard /><TeamCard /></>, channels: <ChannelsTab />,
    products: <ProductsTab />, faq: <FaqTab />, email: <EmailTab /> };
  return <div className="settings-workspace">
    <div className="page-head"><div><h1>Cài đặt</h1><p>Quản lý shop, kênh kết nối, sản phẩm và nội dung hỗ trợ khách hàng.</p></div></div>
    <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />
    <div className="tab-panel" key={tab}>
      {content[tab]}
    </div>
  </div>;
}
