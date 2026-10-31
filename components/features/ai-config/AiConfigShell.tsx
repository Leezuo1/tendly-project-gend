'use client';

import { useSwipeCollapse } from '@/lib/hooks/useSwipeCollapse';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { EmailTab } from './EmailTab';
import { FaqTab } from './FaqTab';
import { ProductsTab } from './ProductsTab';

const TABS = [
  { key: 'products', label: 'Nguồn sản phẩm' },
  { key: 'faq', label: 'Câu hỏi thường gặp' },
  { key: 'email', label: 'Email tự động' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function AiConfigShell() {
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'products');
  const { collapsed: tabsCollapsed, setCollapsed: setTabsCollapsed, handlers: tabSwipe } = useSwipeCollapse('x');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cấu hình AI</h1>
          <p>AI dùng sản phẩm, FAQ và kịch bản email đang bật đã lưu để trả lời khách. Thay đổi đã lưu áp dụng từ câu hỏi tiếp theo.</p>
        </div>
      </div>

      <div className="ai-config-workspace" data-tabs-collapsed={tabsCollapsed}>
      <div className="ai-subnav" data-swipe-collapse {...tabSwipe}>
      <button type="button" className="ai-subnav-toggle" aria-label={tabsCollapsed ? 'Hiện mục cấu hình AI' : 'Ẩn mục cấu hình AI'} title={tabsCollapsed ? 'Hiện mục cấu hình AI' : 'Ẩn mục cấu hình AI'} aria-expanded={!tabsCollapsed} aria-controls="ai-subnav" onClick={() => setTabsCollapsed(value => !value)}><span className="swipe-grip" aria-hidden="true" /></button>
      <Tabs id="ai-subnav" tabs={[...TABS]} active={tab} onChange={setTab} />
      </div>

      <div className="tab-panel" key={tab}>
        {tab === 'products' && <ProductsTab />}
        {tab === 'faq' && <FaqTab />}
        {tab === 'email' && <EmailTab />}
      </div>
      </div>
    </>
  );
}
