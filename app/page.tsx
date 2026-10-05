import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import LandingClient from '@/components/LandingClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tendly — Nền tảng chăm sóc khách hàng AI cho shop online',
  description: 'Tendly: Một AI duy nhất — Tự động ra đơn, rảnh tay chăm sóc. Turn clicks into sales, customer queries into smiles — on full autopilot.',
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        {/* HERO */}
        <section className="hero" style={{ padding: '96px 0 88px', position: 'relative', overflow: 'hidden' }}>
          <div className="wrap" style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: '52px', alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div className="hero-content">
              <div className="hero-quote-box reveal">
                <h1 style={{ fontSize: 'clamp(34px, 4vw, 46px)', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.025em', maxWidth: 580 }}>
                  Một AI duy nhất — <span style={{ color: 'var(--coral)' }}>Tự động ra đơn</span>, rảnh tay chăm sóc.
                </h1>
              </div>
              <div className="quote-card reveal" style={{ transitionDelay: '0.16s', marginTop: 22, maxWidth: 520, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', border: '1px solid var(--line)', borderLeft: '3.5px solid var(--coral)', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 6px 20px rgba(43,33,30,0.05)' }}>
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: '#FCE4E2', color: 'var(--coral-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.55, fontStyle: 'italic', letterSpacing: '-0.01em' }}>
                  Turn clicks into sales, customer queries into smiles —{' '}
                  <span style={{ color: 'var(--coral-deep)', fontWeight: 700, fontStyle: 'normal' }}>on full autopilot.</span>
                </p>
              </div>
              <div className="hero-ctas reveal" style={{ transitionDelay: '0.24s', marginTop: 32, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <a href="/tong-quan" className="btn-primary">
                  <span>Đăng ký / Đăng nhập</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </a>
                <a href="#steps" className="btn-ghost">Xem cách hoạt động</a>
              </div>
              <div className="reveal" style={{ transitionDelay: '0.32s', marginTop: 20, fontSize: 13.5, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--moss)', fontWeight: 700 }}>✓</span>
                Kết nối kênh trong 2 phút — không cần biết lập trình
              </div>
            </div>

            {/* HERO MOCKUP */}
            <div className="mock" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 24px 48px -24px rgba(43,33,30,0.18)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                <span>HỘP THOẠI HỢP NHẤT</span>
                <span style={{ background: 'var(--coral)', color: 'white', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>3 mới</span>
              </div>
              {[
                { initials: 'TN', bg: '#FCE4E2', color: 'var(--coral-deep)', name: 'Trang N.', tag: 'Cảm xúc âm', tagClass: 'tag-high', msg: 'Đơn của mình 4 ngày chưa thấy giao, shop check giúp gấp ạ!', dotColor: '#1877F2', channel: 'Facebook · 2 phút trước' },
                { initials: 'KD', bg: 'var(--moss-soft)', color: 'var(--moss)', name: 'Khánh D.', tag: 'Khách quay lại', tagClass: 'tag-return', msg: 'Áo polo đợt trước mặc thích lắm, shop còn màu xám size L không?', dotColor: '#FF0050', channel: 'TikTok · 14 phút trước' },
                { initials: 'LP', bg: 'var(--sand)', color: 'var(--ink-soft)', name: 'Linh P.', tag: 'Khách mới', tagClass: 'tag-new', msg: 'Shop có ship hoả tốc quận 1 trong chiều nay được không ạ?', dotColor: '#0068FF', channel: 'Zalo · 28 phút trước' },
              ].map((r, i) => (
                <div key={i} className="mock-row" style={{ display: 'flex', gap: 14, padding: '16px 20px', borderBottom: i < 2 ? '1px solid var(--sand)' : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: r.color }}>{r.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: r.tagClass === 'tag-high' ? '#FCE4E2' : r.tagClass === 'tag-return' ? 'var(--moss-soft)' : 'var(--sand)', color: r.tagClass === 'tag-high' ? 'var(--coral-deep)' : r.tagClass === 'tag-return' ? 'var(--moss)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{r.tag}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.msg}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.dotColor, display: 'inline-block' }}></span>
                      {r.channel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BRAND LOGO SLIDER */}
        <section style={{ padding: '48px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--paper)', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 32 }}>
            Hỗ trợ kết nối đa nền tảng cho shop online
          </div>
          <div style={{ overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)' }}>
            <div className="brands-track" style={{ display: 'flex', animation: 'marquee 25s linear infinite', width: 'max-content' }}>
              {[...Array(2)].flatMap((_, setIdx) =>
                [
                  { letter: 'f', name: 'Facebook', bg: '#1877F2' },
                  { letter: '♪', name: 'TikTok Shop', bg: '#000000' },
                  { letter: 'Z', name: 'Zalo OA', bg: '#0068FF' },
                  { letter: 'L', name: 'Lazada', bg: '#0F146D' },
                  { letter: 'G', name: 'GrabExpress', bg: '#00B14F' },
                  { letter: 'M', name: 'MoMo', bg: '#A50064' },
                ].map((b, i) => (
                  <div key={`${setIdx}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 40px', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: b.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: 'white' }}>{b.letter}</div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{b.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="section" style={{ background: 'var(--sand)' }}>
          <div className="wrap">
            <div className="stats-grid stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
              {[
                { num: '3.500+', label: 'Shop đang dùng', target: 3500 },
                { num: '98%', label: '% hội thoại được AI xử lý', target: 98 },
                { num: '45', label: 'giây phản hồi trung bình', target: 45 },
                { num: '3', label: 'kênh tích hợp sẵn', target: 3 },
              ].map((s, i) => (
                <div key={i} className="stat-item reveal" style={{ padding: '32px 16px', borderRadius: 16 }}>
                  <div className="stat-number" data-target={s.target} style={{ fontSize: 44, fontWeight: 900, color: 'var(--coral)', lineHeight: 1.1, marginBottom: 6 }}>0</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section" id="steps" style={{ background: 'var(--canvas)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <div className="section-divider"></div>
              <h2>Cách hoạt động</h2>
              <p>Bắt đầu trong 5 phút. Không cần cài đặt phức tạp, không cần đổi quy trình hiện tại của shop.</p>
            </div>
            <div className="steps stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid var(--line)' }}>
              {[
                { num: 'BƯỚC 01', title: 'Kết nối kênh & nhập sản phẩm', body: 'Liên kết Facebook, TikTok, Zalo chỉ với vài click. Upload danh mục sản phẩm qua file Excel/CSV hoặc nhập tay để AI nắm rõ thông tin tồn kho và giá cả.' },
                { num: 'BƯỚC 02', title: 'AI tự phân loại & trả lời', body: 'AI tự động giải đáp câu hỏi thường gặp về giá, size, phí ship. Nhận diện khách hàng có cảm xúc tiêu cực để đẩy lên đầu hàng đợi và chuyển nhân viên xử lý kịp thời.' },
                { num: 'BƯỚC 03', title: 'Email cá nhân hoá & đo hiệu quả', body: 'Tự động gửi email chăm sóc lại theo kịch bản thông minh (khách hỏi chưa chốt, gửi voucher xoa dịu). Đo lường tỷ lệ phản hồi trực tiếp trên bảng điều khiển.' },
              ].map((step, i) => (
                <div key={i} className="step reveal" style={{ padding: '36px 32px 36px 0', borderRight: i < 2 ? '1px solid var(--line)' : 'none', position: 'relative' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--coral)', marginBottom: 18 }}>{step.num}</div>
                  <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MAIN FEATURES */}
        <section className="section" id="features" style={{ background: 'var(--sand)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <div className="section-divider"></div>
              <h2>Ba việc Tendly làm thay bạn</h2>
              <p>Không phải công cụ riêng lẻ — cùng một luồng dữ liệu khách hàng chảy xuyên suốt cả ba.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
              <div className="feat-main reveal-left" style={{ background: 'var(--ink)', color: 'var(--canvas)', borderRadius: 20, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 340, position: 'relative', overflow: 'hidden' }}>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, maxWidth: 360, lineHeight: 1.3 }}>Hộp thoại hợp nhất — quản lý mọi kênh trong 1 màn hình</h3>
                  <p style={{ marginTop: 14, color: '#D8D0CB', fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>Facebook, TikTok, Zalo — mọi tin nhắn, bình luận gom về một nơi. AI phân loại cảm xúc, xếp ưu tiên, gắn nhãn tự động để bạn không bỏ sót khách quan trọng.</p>
                </div>
                <a href="#details" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, padding: '11px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24, textDecoration: 'none' }}>
                  <span>Xem chi tiết</span><span>→</span>
                </a>
              </div>
              <div className="feat-side stagger" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { icon: '🤖', iconBg: '#FCE4E2', title: 'Cấu hình AI dễ dàng', body: 'Upload file Excel/CSV hoặc nhập tay dữ liệu sản phẩm, thêm câu hỏi thường gặp — AI tự học và trả lời khách chính xác theo thông tin shop.' },
                  { icon: '✉️', iconBg: 'var(--moss-soft)', title: 'Email cá nhân hoá tự động', body: 'AI soạn email dựa trên hội thoại thực tế — đúng sản phẩm khách hỏi, đúng ngữ cảnh. Bạn chỉ cần duyệt hoặc để hệ thống tự gửi.' },
                ].map((card, i) => (
                  <div key={i} className="feat-card reveal" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20, padding: 32, flex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 18 }}>{card.icon}</div>
                    <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{card.title}</h4>
                    <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* MORE FEATURES BENTO */}
        <section className="section" style={{ background: 'var(--canvas)' }}>
          <div className="wrap">
            <div className="section-head reveal">
              <div className="section-divider"></div>
              <h2>Và còn nhiều tính năng nữa...</h2>
              <p>Mỗi tính năng được thiết kế cho người bán hàng online Việt Nam.</p>
            </div>
            <div className="feat-bento stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {[
                { icon: '📊', iconBg: 'var(--coral)', iconColor: 'white', tag: 'Dashboard', tagBg: '#FCE4E2', tagColor: 'var(--coral-deep)', title: 'Tổng quan thời gian thực', body: 'Xem ngay hội thoại đang chờ, ca cần xử lý gấp (cảm xúc âm), email đã gửi hôm nay và đơn ước tính qua chat — tất cả trên 1 dashboard.' },
                { icon: '🔗', iconBg: 'var(--moss-soft)', span: 2, tag: 'Đa kênh', tagBg: 'var(--moss-soft)', tagColor: 'var(--moss)', title: 'Tích hợp 3 kênh bán hàng', body: 'Facebook Page, TikTok Shop, Zalo OA — kết nối trong 2 phút, mọi tin nhắn và bình luận tự chảy về 1 hộp thư. Không cần mở nhiều tab, không sót khách.' },
                { icon: '😤', iconBg: 'var(--sand)', tag: 'AI', tagBg: 'var(--sand)', tagColor: 'var(--ink-soft)', title: 'Phân tích cảm xúc', body: 'AI tự nhận diện hội thoại có cảm xúc tiêu cực. Khách không hài lòng sẽ được đánh dấu "cần xử lý gấp" và tự chuyển sang nhân viên.' },
                { icon: '📋', iconBg: '#E7DED7', title: 'Quản lý sản phẩm & FAQ', body: 'Import danh mục sản phẩm bằng file Excel/CSV hoặc nhập tay. Thêm câu hỏi thường gặp để AI trả lời chính xác thay bạn.' },
                { icon: '📈', iconBg: '#FCE4E2', title: 'Báo cáo chi tiết', body: 'Theo dõi tỷ lệ phản hồi sau email, thời gian phản hồi trung bình, số ca đã xoa dịu và tỷ lệ mở email — với biểu đồ trực quan theo ngày.' },
              ].map((item, i) => (
                <div key={i} className="feat-item reveal" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 32px', gridColumn: item.span === 2 ? 'span 2' : undefined }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 22 }}>{item.icon}</div>
                  {item.tag && <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, marginBottom: 14, background: item.tagBg, color: item.tagColor }}>{item.tag}</span>}
                  <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{item.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DETAIL FEATURES */}
        <section className="section" id="details" style={{ background: 'var(--sand)', overflow: 'hidden' }}>
          <div className="wrap">
            {/* Detail 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', padding: '72px 0' }}>
              <div className="reveal-left">
                <div className="section-divider"></div>
                <h3 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>Hộp thoại hợp nhất — chấm dứt mở 10 tab cùng lúc</h3>
                <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>Mọi tin nhắn từ Facebook, TikTok, Zalo đều chảy về một nơi. Bạn chỉ cần mở Tendly và trả lời — hệ thống tự gửi phản hồi về đúng kênh khách nhắn.</p>
                <ul style={{ listStyle: 'none' }}>
                  {['Hỗ trợ Facebook Page, TikTok Shop, Zalo OA', 'Tự đồng bộ bình luận bài đăng + inbox', 'Phân loại cảm xúc, xếp ưu tiên tự động', 'Chuyển nhân viên khi phát hiện cảm xúc tiêu cực'].map((li, i) => (
                    <li key={i} style={{ padding: '9px 0', fontSize: 15, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, background: '#FCE4E2', color: 'var(--coral-deep)' }}>✓</span>
                      {li}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal-right" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, boxShadow: '0 16px 40px rgba(43,33,30,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700 }}>📬 Hộp thoại hợp nhất</h4>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['Tất cả', 'Facebook', 'TikTok', 'Zalo'].map((tab, i) => (
                      <span key={i} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: i === 0 ? '#FCE4E2' : 'var(--sand)', color: i === 0 ? 'var(--coral-deep)' : 'var(--ink-soft)' }}>{tab}</span>
                    ))}
                  </div>
                </div>
                {[
                  { initials: 'Tr', bg: '#1877F2', name: 'Trang N.', src: 'Facebook', preview: '"Ib giá áo khoác size M, mình để lại sđt..."', time: '2 phút', badge: true },
                  { initials: 'Kh', bg: '#FF0050', name: 'Khánh D.', src: 'TikTok', preview: '"Còn màu đen không bạn ơi? Có ship COD..."', time: '15 phút', badge: true },
                  { initials: 'Li', bg: '#0068FF', name: 'Linh P.', src: 'Zalo OA', preview: '"Check giúp mình đơn hàng giao đến đâu rồi nha"', time: '45 phút', badge: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 'none', alignItems: 'center' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', background: item.bg }}>{item.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name} · <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{item.src}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.preview}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{item.time}</div>
                      {item.badge && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', marginTop: 4, marginLeft: 'auto' }}></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', padding: '72px 0', borderTop: '1px solid var(--line)' }}>
              <div className="reveal-left" style={{ order: 2 }}>
                <div className="section-divider"></div>
                <h3 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>Email cá nhân hoá đúng ngữ cảnh bán hàng</h3>
                <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>Không gửi email spam đồng loạt. Tendly tự động soạn email dựa trên đúng lịch sử trò chuyện — nhắc lại sản phẩm khách vừa hỏi, tặng voucher xoa dịu khi khách gặp sự cố giao trễ.</p>
                <ul style={{ listStyle: 'none' }}>
                  {['Kịch bản: Khách hỏi nhưng chưa chốt đơn (gửi sau 24h)', 'Kịch bản: Tự động gửi voucher xin lỗi khi khách bực', 'Kịch bản: Nhắc giỏ hàng bỏ quên kèm ưu đãi', 'Đo tỷ lệ phản hồi và tỷ lệ mở email chi tiết'].map((li, i) => (
                    <li key={i} style={{ padding: '9px 0', fontSize: 15, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, background: 'var(--moss-soft)', color: 'var(--moss)' }}>✓</span>
                      {li}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal-right" style={{ order: 1, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, boxShadow: '0 16px 40px rgba(43,33,30,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>✉️ Tendly — Email soạn tự động</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: '#FCE4E2', color: 'var(--coral-deep)', fontSize: 11, fontWeight: 700 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--coral)' }}></div>
                    AI generated
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.8 }}>
                  <p><strong>Chào Minh Anh,</strong></p>
                  <p style={{ marginTop: 6 }}>Hôm qua bạn có hỏi shop về mẫu <em>áo khoác dạ AK-23 size M</em> trên Facebook mà chưa kịp chốt nè.</p>
                  <div style={{ background: '#FFF5F5', borderLeft: '3px solid var(--coral)', padding: '8px 12px', margin: '12px 0', borderRadius: '0 8px 8px 0' }}>
                    🎉 Size M màu be chỉ còn <strong>2 chiếc cuối</strong> thôi á! Shop gửi tặng riêng bạn mã <strong>MINHANH10</strong> giảm 10% trong 24h nha.
                  </div>
                  <p style={{ marginTop: 6 }}>Bạn cần giữ hàng thì nhắn lại shop giữ ngay nha! Chúc bạn ngày mới vui vẻ ✨</p>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'var(--coral)', color: 'white' }}>Gửi ngay cho khách</button>
                  <button style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--sand)', color: 'var(--ink-soft)', border: '1px solid var(--line)' }}>Chỉnh sửa nội dung</button>
                </div>
              </div>
            </div>

            {/* Detail 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', padding: '72px 0', borderTop: '1px solid var(--line)' }}>
              <div className="reveal-left">
                <div className="section-divider"></div>
                <h3 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>Bảng điều khiển & Báo cáo hiệu quả</h3>
                <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>Biết chính xác AI đang hoạt động ra sao: có bao nhiêu khách hàng được xử lý, tỷ lệ phản hồi sau email marketing, và các ca khiếu nại đã được xoa dịu thành công.</p>
                <ul style={{ listStyle: 'none' }}>
                  {['Stat cards: Hội thoại đang chờ & Cần xử lý gấp', 'Đo lường đơn ước tính từ tín hiệu hội thoại', 'Biểu đồ tỷ lệ phản hồi sau email theo ngày', 'Danh sách sản phẩm được khách hỏi nhiều nhất'].map((li, i) => (
                    <li key={i} style={{ padding: '9px 0', fontSize: 15, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, background: 'var(--sand)', color: 'var(--ink)' }}>✓</span>
                      {li}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal-right" style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, boxShadow: '0 16px 40px rgba(43,33,30,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Hội thoại đang chờ', value: '12', sub: '3 ca cần xử lý gấp', color: 'var(--coral-deep)' },
                    { label: 'Cần xử lý gấp (cảm xúc âm)', value: '3', sub: 'AI đã gửi voucher xin lỗi', color: 'var(--coral)', subColor: 'var(--moss)' },
                    { label: 'Email tự động hôm nay', value: '38', sub: 'Tỷ lệ mở 68%', color: 'var(--ink)', subColor: 'var(--moss)' },
                    { label: 'Đơn ước tính qua chat', value: '24', sub: '*ước tính từ tín hiệu chat', color: 'var(--coral-deep)' },
                  ].map((card, i) => (
                    <div key={i} style={{ background: 'var(--sand)', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{card.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: card.color, marginTop: 2 }}>{card.value}</div>
                      <div style={{ fontSize: 10.5, color: card.subColor || 'var(--ink-soft)', marginTop: 2 }}>{card.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--sand)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📈 Tỷ lệ phản hồi sau email (7 ngày gần nhất)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                    {[35, 50, 40, 65, 55, 80, 90].map((h, i) => (
                      <div key={i} style={{ flex: 1, background: i === 6 ? 'var(--coral-deep)' : 'var(--coral)', borderRadius: '4px 4px 0 0', height: `${h}%`, opacity: i === 6 ? 1 : 0.6 + i * 0.05 }}></div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: i === 6 ? 700 : 400 }}>{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section cta-section" id="cta" style={{ padding: '96px 0' }}>
          <div className="wrap">
            <div className="cta-final reveal-scale" style={{ background: 'linear-gradient(145deg, #FFFFFF 0%, #FAF6F1 50%, #F1EAE3 100%)', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 28, padding: '76px 52px 68px', textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 50px rgba(43,33,30,0.08)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 12% 18%, rgba(240,106,106,0.1) 0%, transparent 45%), radial-gradient(circle at 88% 82%, rgba(75,99,88,0.08) 0%, transparent 45%)', pointerEvents: 'none' }}></div>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, zIndex: 2 }}>
                <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,106,106,0.22) 0%, transparent 70%)', filter: 'blur(8px)' }}></div>
                <div style={{ width: 58, height: 58, borderRadius: 16, background: '#FCE4E2', border: '1px solid rgba(240,106,106,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral-deep)', position: 'relative', zIndex: 2, boxShadow: '0 8px 20px rgba(240,106,106,0.15)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                    <polyline points="9 9 12 12 15 9"></polyline>
                  </svg>
                </div>
              </div>
              <h2 style={{ fontSize: 36, fontWeight: 800, maxWidth: 680, lineHeight: 1.25, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 auto 16px', position: 'relative', zIndex: 2 }}>
                Chăm Sóc Khách Hàng Bằng AI: Tự Động, Cá Nhân Hoá, Đo Lường Được.
              </h2>
              <p style={{ fontSize: 16.5, color: 'var(--ink-soft)', maxWidth: 500, margin: '0 auto 34px', lineHeight: 1.6, position: 'relative', zIndex: 2 }}>
                Bắt đầu gom hội thoại, để AI trả lời và chăm sóc khách tự động ngay hôm nay.
              </p>
              <a href="/tong-quan" className="btn-primary" style={{ fontSize: 16.5, fontWeight: 700, padding: '17px 36px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 30px rgba(240,106,106,0.38)', position: 'relative', zIndex: 2 }}>
                <span>Bắt đầu ngay</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 22, position: 'relative', zIndex: 2 }}>
                {[
                  { icon: '💳', text: 'Không cần thẻ tín dụng' },
                  { icon: '⏱', text: 'Kết nối trong 2 phút' },
                  { icon: '🛡', text: 'Huỷ bất cứ lúc nào' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-soft)', fontWeight: 500 }}>
                    {i > 0 && <span style={{ color: '#D8CDC4' }}>•</span>}
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <LandingClient />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes rise { to { opacity: 1; transform: translateY(0); } }
        .mock {
          opacity: 0; transform: translateY(14px);
          animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.25s forwards;
        }
        .mock-row { transition: background 0.3s ease, transform 0.3s ease; }
        .mock-row:hover { background: var(--sand); transform: translateX(4px); }
        .step { transition: transform 0.3s ease; }
        .step:hover { transform: translateY(-4px); }
        .feat-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .feat-card:hover { transform: translateY(-5px); box-shadow: 0 12px 28px rgba(43,33,30,0.1); }
        .feat-item { transition: transform 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease; }
        .feat-item:hover { transform: translateY(-6px); border-color: var(--coral); box-shadow: 0 16px 36px rgba(43,33,30,0.1); }
        .stat-item { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .stat-item:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(43,33,30,0.08); }
        @media (max-width: 900px) {
          .hero .wrap, section[style*="gridTemplateColumns: 1.08fr"] .wrap { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
