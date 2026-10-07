'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/shared/ToastProvider';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { resetMockData } from '@/lib/services/api';
import { ChannelsTab } from './ChannelsTab';
import { PlanCard } from './PlanCard';
import { ShopInfoCard } from './ShopInfoCard';
import { TeamCard } from './TeamCard';

const TABS = [
  { key: 'account', label: 'Tài khoản & nhân viên' },
  { key: 'channels', label: 'Tích hợp kênh' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function SettingsShell() {
  const toast = useToast();
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'account');
  const [confirmReset, setConfirmReset] = useState(false);
  // đổi key để remount các card sau khi reset dữ liệu mẫu
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cài đặt</h1>
          <p>Quản lý thông tin shop, nhân viên và các kênh đang kết nối.</p>
        </div>
      </div>

      <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />

      <div className="tab-panel" key={`${tab}-${resetKey}`}>
        {tab === 'account' ? (
          <>
            <ShopInfoCard />
            <PlanCard />
            <TeamCard />
            <div className="card">
              <div className="reset-box">
                <div>
                  <div className="card-head" style={{ marginBottom: 4 }}><h2>Dữ liệu mẫu</h2></div>
                  <p>Bản demo đang chạy bằng dữ liệu giả lập lưu trên trình duyệt. Khôi phục để quay về dữ liệu ban đầu.</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setConfirmReset(true)}>Khôi phục dữ liệu mẫu</button>
              </div>
            </div>
          </>
        ) : (
          <ChannelsTab />
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Khôi phục dữ liệu mẫu?"
        message="Mọi thay đổi (thông tin shop, nhân viên, FAQ, sản phẩm, kịch bản email...) sẽ quay về như ban đầu."
        confirmLabel="Khôi phục"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetMockData();
          setResetKey((k) => k + 1);
          setConfirmReset(false);
          toast('Đã khôi phục dữ liệu mẫu');
        }}
      />
    </>
  );
}
