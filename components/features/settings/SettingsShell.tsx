'use client';
import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { ChannelsTab } from './ChannelsTab';
import { PlanCard } from './PlanCard';
import { ShopInfoCard } from './ShopInfoCard';
import { TeamCard } from './TeamCard';
import { ProductsTab } from '@/components/features/ai-config/ProductsTab';
import { FaqTab } from '@/components/features/ai-config/FaqTab';
import { ContextTagsTab } from './ContextTagsTab';

const TABS = [
  { key: 'account', label: 'Tài khoản & nhân viên' }, { key: 'channels', label: 'Tích hợp kênh' },
  { key: 'products', label: 'Nguồn sản phẩm' }, { key: 'faq', label: 'FAQ' }, { key: 'tags', label: 'Gắn thẻ theo ngữ cảnh' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
export function SettingsShell() {
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'account');
  // Keep unsaved product edits between Settings tabs, without loading the catalog before its first visit.
  const [keepProductsMounted, setKeepProductsMounted] = useState(tab === 'products');
  if (tab === 'products' && !keepProductsMounted) setKeepProductsMounted(true);
  const content = { account: <><ShopInfoCard /><PlanCard /><TeamCard /></>, channels: <ChannelsTab />,
    faq: <FaqTab />, tags: <ContextTagsTab /> };
  return <div className="settings-workspace">
    <div className="page-head"><div><h1>Cài đặt</h1><p>Quản lý shop, kênh kết nối, sản phẩm và nội dung hỗ trợ khách hàng.</p></div></div>
    <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />
    {tab !== 'products' && <div className="tab-panel" key={tab}>{content[tab]}</div>}
    {keepProductsMounted && <div className="tab-panel" hidden={tab !== 'products'}><ProductsTab /></div>}
  </div>;
}
