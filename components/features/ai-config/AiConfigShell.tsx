'use client';

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
  const [tab, setTab] = useTabParam<TabKey>(TABS.map(t => t.key), 'products');
  const content = { products: <ProductsTab />, faq: <FaqTab />, email: <EmailTab /> };
  return <>
    <div className="page-head ai-config-heading"><div><h1>Cấu hình AI</h1><p>AI dùng sản phẩm, FAQ và kịch bản email đang bật đã lưu để trả lời khách. Thay đổi đã lưu áp dụng từ câu hỏi tiếp theo.</p></div></div>
    <div className="ai-config-workspace">
      <Tabs id="ai-subnav" tabs={[...TABS]} active={tab} onChange={setTab} />
      <div className="tab-panel" key={tab}>{content[tab]}</div>
    </div>
  </>;
}
