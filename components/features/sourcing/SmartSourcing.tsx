'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconCart, IconSearch, IconSpark, IconRefresh } from '@/components/ui/Icons';
import { sourcingDemos, type SourcingProduct } from '@/lib/data/smartSourcing';
import { useMockOnboarding } from '@/lib/hooks/useMockOnboarding';
import styles from './sourcing.module.css';

const steps = ['Đọc ngành hàng', 'Tìm từ khóa', 'Gợi ý sản phẩm', 'Tìm nguồn hàng'];
const number = new Intl.NumberFormat('vi-VN');

export function SmartSourcing() {
  const { ready, workspace } = useMockOnboarding();
  return <div className={styles.root}>
    <header className="page-head"><div><p className={styles.eyebrow}>TỪ XU HƯỚNG ĐẾN CƠ HỘI</p><h1>Smart Sourcing</h1><p>Lắng nghe thị trường, tìm ý tưởng mới cho shop của bạn.</p></div><span className={styles.demoBadge}>Bản demo</span></header>
    <div className={styles.notice}><IconSpark aria-hidden="true" /><p>Trải nghiệm bằng dữ liệu mẫu. Từ khóa, lượt thảo luận, giá và nhà cung cấp đều minh họa cho luồng hoạt động; chưa thu thập dữ liệu mạng xã hội thật.</p></div>
    {!ready ? <p role="status">Đang đọc ngành hàng của shop…</p> : !workspace ? <section className={`card ${styles.empty}`}><IconSearch aria-hidden="true" /><h2>Shop của bạn kinh doanh ngành gì?</h2><p>Thêm tên shop và ngành hàng trong Cài đặt để bắt đầu khám phá.</p><Button href="/cai-dat">Thiết lập thông tin shop →</Button></section>
      : !Object.hasOwn(sourcingDemos, workspace.industry) ? <section className={`card ${styles.empty}`}><h2>Chưa có dữ liệu mẫu cho ngành này</h2><p>Chọn một ngành có sẵn trong Cài đặt để trải nghiệm demo.</p><Button href="/cai-dat">Chọn ngành hàng →</Button></section>
        : <SourcingFlow key={workspace.industry} industry={workspace.industry} shopName={workspace.name} />}
  </div>;
}

function SourcingFlow({ industry, shopName }: { industry: string; shopName: string }) {
  const demo = sourcingDemos[industry];
  const [stage, setStage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<SourcingProduct | null>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const busy = stage > 0 && stage < 4;
  const complete = stage === 4;

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setStage(value => value + 1), 450);
    return () => window.clearTimeout(timer);
  }, [stage, busy]);

  useEffect(() => {
    if (selected) sourceHeading.current?.focus();
  }, [selected]);

  function analyze() {
    setKeyword('');
    setSelected(null);
    setStage(1);
  }

  return <>
    <section className={styles.context} aria-label="Ngành hàng đang theo dõi">
      <div><span className={styles.eyebrow}>NGÀNH HÀNG CỦA {shopName}</span><h2>{industry}</h2><Link href="/cai-dat">Đổi ngành trong Cài đặt ↗</Link></div>
      <Button onClick={analyze} disabled={busy}>{busy ? <span className="spinner" aria-hidden="true" /> : complete ? <IconRefresh aria-hidden="true" /> : <IconSearch aria-hidden="true" />}{busy ? 'Đang phân tích mẫu…' : complete ? 'Phân tích lại dữ liệu mẫu' : 'Phân tích xu hướng mẫu'}</Button>
    </section>
    <ol className={styles.steps} aria-label="Luồng Smart Sourcing">{steps.map((label, index) => <li key={label} className={(index === 0 || (index < 3 && stage > index) || (index === 3 && selected)) ? styles.stepDone : ''}><span>{index + 1}</span>{label}</li>)}</ol>
    <p className={styles.status} role="status">{busy ? `${steps[stage - 1]} — đang mô phỏng…` : complete ? `Đã phân tích bộ mẫu ngành ${industry}. Chọn sản phẩm để xem nguồn hàng.` : 'Sẵn sàng phân tích. Không cần kết nối nền tảng để trải nghiệm.'}</p>
    {!complete ? <section className={`card ${styles.empty}`} aria-busy={busy}><IconSearch aria-hidden="true" /><h2>{busy ? 'Đang kết nối các ý tưởng…' : 'Cơ hội tiếp theo bắt đầu từ ngành hàng của bạn'}</h2><p>Tendly mô phỏng việc đọc thảo luận trên Facebook, TikTok và sàn thương mại điện tử, nhận diện nhu cầu rồi gợi ý sản phẩm và nguồn cung phù hợp.</p><div className={styles.channels}><span>Facebook · mẫu</span><span>TikTok · mẫu</span><span>Sàn TMĐT · mẫu</span></div></section> : <>
      <div className={styles.metrics}>
        <div><span>Từ khóa tiềm năng</span><strong>{demo.products.length.toString().padStart(2, '0')}</strong><small>Trong bộ dữ liệu mẫu</small></div>
        <div><span>Lượt thảo luận mẫu</span><strong>{number.format(demo.products.reduce((sum, item) => sum + item.mentions, 0))}</strong><small>Kịch bản minh họa 7 ngày</small></div>
        <div><span>Ý tưởng sản phẩm / dịch vụ</span><strong>{demo.products.length.toString().padStart(2, '0')}</strong><small>Phù hợp với ngành đã chọn</small></div>
      </div>
      <section className={`card ${styles.keywords}`} aria-labelledby="keywords-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / SOCIAL LISTENING</p><h2 id="keywords-heading">Khách hàng đang quan tâm gì?</h2></div><span className={styles.softBadge}>7 ngày · dữ liệu mẫu</span></div>
        <p className={styles.muted}>Chọn từ khóa để xem ý tưởng sản phẩm liên quan.</p>
        <div className={styles.keywordList}>
          <button type="button" aria-pressed={!keyword} onClick={() => { setKeyword(''); setSelected(null); }}>Tất cả</button>
          {demo.products.map(item => <button type="button" key={item.keyword} aria-pressed={keyword === item.keyword} onClick={() => { setKeyword(item.keyword); setSelected(null); }}><span>#{item.keyword}</span><strong>+{item.growth}%</strong></button>)}
        </div>
        <p className={styles.caption}>Mức tăng minh họa so với 7 ngày trước, không phải số liệu thị trường đã đo.</p>
      </section>
      <section aria-labelledby="products-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / CƠ HỘI SẢN PHẨM</p><h2 id="products-heading">Từ thảo luận đến ý tưởng nhập hàng</h2></div><span className={styles.softBadge}>{keyword ? '1' : demo.products.length} gợi ý mẫu</span></div>
        <div className={styles.products}>{demo.products.filter(item => !keyword || item.keyword === keyword).map((item, index) => <article className={styles.product} key={item.name}>
          <div className={styles.productTop}><span className={styles.productIcon}><IconCart aria-hidden="true" /></span><span className={styles.growth}>↗ +{item.growth}% quan tâm mẫu</span></div>
          <span className={styles.caption}>GỢI Ý {index + 1} · {item.channel} (mẫu)</span><h3>{item.name}</h3><p className={styles.productSignal}>{item.signal}</p>
          <div className={styles.evidence}><span>#{item.keyword}</span><strong>{number.format(item.mentions)} lượt nhắc mẫu</strong></div>
          <Button variant="outline" onClick={() => setSelected(item)} aria-pressed={selected?.name === item.name}>Tìm nguồn hàng <span aria-hidden="true">→</span></Button>
        </article>)}</div>
      </section>
      {selected && <section className={`card ${styles.sources}`} aria-labelledby="sources-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / SMART SOURCING</p><h2 id="sources-heading" ref={sourceHeading} tabIndex={-1}>Nguồn hàng cho {selected.name}</h2></div><span className={styles.softBadge}>Nhà cung cấp giả định</span></div>
        <div className={styles.quote}><div><span>Giá đầu vào minh họa</span><strong>{selected.price}</strong></div><div><span>Đặt tối thiểu minh họa</span><strong>{selected.minOrder}</strong></div></div>
        <div className={styles.suppliers}>{demo.suppliers.map(supplier => <article key={supplier.name}><span className={styles.supplierTag}>NGUỒN MẪU · CHƯA XÁC MINH</span><h3>{supplier.name}</h3><dl><div><dt>Khu vực giả định</dt><dd>{supplier.location}</dd></div><div><dt>Thời gian dự kiến mẫu</dt><dd>{supplier.leadTime}</dd></div></dl><a className="btn btn-outline" href={`https://www.google.com/search?q=${encodeURIComponent(`${selected.name} ${supplier.query}`)}`} target="_blank" rel="noopener noreferrer">Tra cứu nguồn tương tự ↗<span className={styles.srOnly}> (mở tab mới)</span></a></article>)}</div>
        <p className={styles.caption}>Các liên kết mở tìm kiếm Google để bạn tự khảo sát. Tendly chưa xác minh nhà cung cấp, lấy báo giá hay đặt hàng.</p>
      </section>}
    </>}
  </>;
}
