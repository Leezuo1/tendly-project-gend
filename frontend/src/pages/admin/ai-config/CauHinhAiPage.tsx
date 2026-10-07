import { Tabs } from '../../../components/Tabs';
import { useTabParam } from '../../../hooks/useTabParam';
import { EmailTab } from './EmailTab';
import { FaqTab } from './FaqTab';
import { ProductsTab } from './ProductsTab';
import './ai-config.css';

const TABS = [
  { key: 'products', label: 'Nguồn sản phẩm' },
  { key: 'faq', label: 'Câu hỏi thường gặp' },
  { key: 'email', label: 'Email tự động' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function CauHinhAiPage() {
  const [tab, setTab] = useTabParam<TabKey>(TABS.map((t) => t.key), 'products');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cấu hình AI</h1>
          <p>Dạy AI hiểu sản phẩm và cách phản ứng tự động với khách.</p>
        </div>
      </div>

      <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />

      <div className="tab-panel" key={tab}>
        {tab === 'products' && <ProductsTab />}
        {tab === 'faq' && <FaqTab />}
        {tab === 'email' && <EmailTab />}
      </div>
    </>
  );
}
