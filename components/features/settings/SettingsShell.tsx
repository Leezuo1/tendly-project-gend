'use client';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { ChannelsTab } from './ChannelsTab';
import { PlanCard } from './PlanCard';
import { ShopInfoCard } from './ShopInfoCard';
import { TeamCard } from './TeamCard';

const TABS = [{ key: 'account', label: 'Tài khoản & nhân viên' }, { key: 'channels', label: 'Tích hợp kênh' }] as const;
type TabKey = (typeof TABS)[number]['key'];
export function SettingsShell() {
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'account');
  return <>
    <div className="page-head"><div><h1>Cài đặt</h1><p>Quản lý thông tin shop, nhân viên và các kênh đang kết nối.</p></div></div>
    <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />
    <div className="tab-panel" key={tab}>
      {tab === 'account' ? <><ShopInfoCard /><PlanCard /><TeamCard /></> : <ChannelsTab />}
    </div>
  </>;
}
