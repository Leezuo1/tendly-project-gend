import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { LandingMotion } from './LandingMotion';
import { DayStory } from './DayStory';
import { SizeDesk } from './SizeDesk';
import styles from './landing.module.css';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const photo = (src: string, alt: string, lazy = true) => (
  <Image unoptimized src={`/landing/story/${src}`} alt={alt} width={640} height={640} loading={lazy ? 'lazy' : 'eager'} decoding="async" />
);

const POINTS: [string, string][] = [
  ['Duyệt trước khi gửi', 'Tự trả lời mặc định tắt. Shop trả lời tay trước.'],
  ['Bám sản phẩm và FAQ', 'Tendly chỉ tham chiếu thông tin shop đã nhập.'],
  ['Thiếu căn cứ thì giữ lại', 'Câu hỏi không có đáp án trong dữ liệu về tay shop.'],
  ['Đơn chỉ là bản nháp', 'Shop kiểm tra rồi mới xác nhận đơn.'],
  ['Sửa nhanh bản nháp', 'Chỉnh giọng, chỉnh chữ, rồi mới duyệt.'],
  ['Rõ người gửi, rõ Fanpage', 'Tên khách và Fanpage luôn hiện trong cuộc trò chuyện.'],
  ['Bài chưa duyệt chưa đăng', 'Nội dung marketing nằm ở bản nháp cho đến khi shop đồng ý.'],
  ['Một hộp thư cho mọi kênh', 'Messenger, Zalo, TikTok và Shopee chung một chỗ duyệt.'],
  ['Khóa kết nối ở phía máy chủ', 'Token của kênh không đi xuống trình duyệt.'],
];

const CHANNELS: [string, string][] = [['messenger', 'Messenger'], ['zalo', 'Zalo'], ['tiktok', 'TikTok'], ['shopee', 'Shopee']];

const FAQ: [string, string][] = [
  ['Tendly hỗ trợ những việc nào?', 'Tìm nguồn hàng với Smart Sourcing, chăm sóc khách hàng, hỗ trợ livestream, soạn bài đăng, tư vấn bán hàng và gửi email cảm ơn sau mua, cùng dữ liệu sản phẩm và FAQ của shop.'],
  ['Kênh nào kết nối được?', 'Facebook Messenger, Zalo, TikTok và Shopee trong cùng một không gian làm việc. Hội thoại, bình luận và sản phẩm được nối với nhau xuyên suốt.'],
  ['AI có tự gửi câu trả lời không?', 'Chỉ khi shop bật tự trả lời. Mặc định Tendly soạn nháp, shop chỉnh và duyệt trước khi gửi. Ca cần người thật được chuyển cho nhân viên.'],
  ['Đơn trong livestream đã chốt chưa?', 'Tendly tạo đơn nháp ngay khi khách chốt trong live. Shop xác nhận, rồi theo dõi thanh toán, vận chuyển và chăm sóc sau mua ngay trong Tendly.'],
  ['AI có thể trả lời sai không?', 'Có. Vì vậy mọi bản nháp đều cho thấy nguồn trong dữ liệu của shop và chờ shop xem lại trước khi đi.'],
];

function Ticket({ step }: { step: 0 | 1 | 2 | 3 }) {
  const chips = ['Mới', 'Nháp từ Tendly', 'Shop đang xem lại', 'Đã duyệt'];
  return (
    <div className={styles.ticket} data-ui data-step={step} data-reveal style={d(140 + step * 180)}>
      <p className={styles.ticketFrom}>Lan Anh · Fanpage Thời trang Mộc</p>
      <p className={styles.ticketMsg}>Áo polo này có size L không ạ?</p>
      {step > 0 && (
        <p className={styles.ticketDraft}>
          Dạ có size L ạ. Với 1m72 · 68kg, bạn có thể tham khảo size L.{step > 1 ? ' Shop sẽ kiểm tra màu trước khi xác nhận nhé.' : ''}
        </p>
      )}
      {step > 0 && <small className={styles.ticketSrc}>Nguồn: Sản phẩm & FAQ của shop</small>}
      <span className={styles.chip} data-final={step === 3}>{chips[step]}</span>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className={styles.root} id="landing-root">
      <a className={styles.skip} href="#home">Đến nội dung chính</a>
      <div className={styles.topbar} aria-hidden="true" />
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerInner}`}>
          <a className={styles.brand} href="#home" aria-label="Tendly, về đầu trang">
            <Image unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} loading="eager" />
          </a>
          <nav className={styles.nav} aria-label="Điều hướng chính">
            <a href="#san-pham">Sản phẩm</a>
            <a href="#cach-hoat-dong">Cách hoạt động</a>
            <a href="#hoi-dap">Hỏi đáp</a>
            <Link href="/pricing">Bảng giá</Link>
          </nav>
          <Link className={styles.btn} href="/dang-nhap">Bắt đầu</Link>
        </div>
        <div className={styles.progress} aria-hidden="true" />
      </header>

      <main id="home">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroField}>
            <div className={styles.wrap}>
              <h1 id="hero-title" className={styles.display} lang="en">
                <span className={styles.line}><span style={d(0)}>Your AI teammate</span></span>
                <span className={styles.line}><span style={d(110)}>for every customer.</span></span>
              </h1>
              <p className={styles.heroLead} data-reveal style={d(220)}>
                <strong>Tendly</strong> soạn nháp câu trả lời, đơn hàng và bài đăng cho shop trên Messenger, Zalo, TikTok và Shopee. Không gì được gửi đi khi shop chưa duyệt.
              </p>
            </div>
          </div>
          <div className={styles.heroPhoto} data-parallax>
            <div className={styles.arch} data-shutter>
              {photo('live-host.webp', 'Chủ shop giơ chiếc áo polo navy trước điện thoại để livestream', false)}
            </div>
            <p className={`${styles.float} ${styles.floatA}`} data-ui style={d(700)}><b>3 khách</b>đang hỏi size L trên live</p>
            <p className={`${styles.float} ${styles.floatB}`} data-ui style={d(900)}><span>Gợi ý size<br />1m72 · 68kg</span><strong>L</strong></p>
          </div>
          <div className={styles.heroBand}>
            <div className={`${styles.wrap} ${styles.bandInner}`}>
              <p className={styles.slogan}>AI soạn. Shop duyệt.</p>
              <a className={styles.btn} href="#thu">Thử với một câu hỏi của khách</a>
            </div>
          </div>
        </section>

        <section className={styles.channels} aria-labelledby="channels-title">
          <h2 id="channels-title" className={`${styles.wrap} ${styles.channelsHead}`}>Một hộp thư cho mọi kênh bán.</h2>
          <div className={styles.marquee}>
            <div className={styles.track}>
              {[0, 1].map(k => (
                <ul key={k} aria-hidden={k === 1 || undefined}>
                  {CHANNELS.map(([file, name]) => (
                    <li key={name}><Image unoptimized src={`/platforms/${file}.svg`} alt="" width={48} height={48} />{name}</li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        <section id="thu" className={styles.live} aria-labelledby="live-title">
          <div className={`${styles.wrap} ${styles.liveGrid}`}>
            <div className={styles.liveIntro}>
              <h2 id="live-title" className={styles.head} data-reveal>Thử một<br />câu hỏi.</h2>
              <p className={styles.lead} data-reveal style={d(90)}>
                Kéo số đo của khách. Tendly soạn nháp từ bảng size của shop, số đo ngoài bảng thì giữ lại cho shop.
              </p>
            </div>
            <SizeDesk />
          </div>
        </section>

        <DayStory />

        <section className={styles.features} aria-labelledby="features-title">
          <div className={styles.featuresPhoto} data-reveal>
            <div className={styles.archTall} data-shutter>{photo('shop-rack.webp', 'Kệ áo polo navy và be trong một shop thời trang')}</div>
          </div>
          <div className={styles.featuresBody}>
            <h2 id="features-title" className={styles.head} data-reveal>Shop giữ quyền.</h2>
            <ul className={styles.points}>
              {POINTS.map(([t, p], i) => (
                <li key={t} data-reveal style={d(60 * (i % 3) + 120)}>
                  <h3><i aria-hidden="true" />{t}</h3>
                  <p>{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="cach-hoat-dong" className={styles.how} aria-labelledby="how-title">
          <ol className={styles.fields}>
            <li>
              <h2 id="how-title" className={styles.fieldHead}>Một tin.<br />Bốn bước.</h2>
              <Ticket step={0} />
              <p className={styles.clause} data-reveal>Trước hết, tin nhắn của khách đến.</p>
            </li>
            <li>
              <Ticket step={1} />
              <p className={styles.clause} data-reveal style={d(80)}>Rồi Tendly soạn nháp từ dữ liệu của shop.</p>
            </li>
            <li>
              <Ticket step={2} />
              <p className={styles.clause} data-reveal style={d(160)}>Sau đó shop đọc lại và sửa nhanh.</p>
            </li>
            <li>
              <Ticket step={3} />
              <p className={styles.clause} data-reveal style={d(240)}>Cuối cùng shop duyệt, rồi mới gửi.</p>
            </li>
          </ol>
        </section>

        <section id="hoi-dap" className={styles.faq} aria-labelledby="faq-title">
          <div className={styles.faqHead}><div className={styles.wrap}><h2 id="faq-title" className={styles.head}>Hay hỏi.</h2></div></div>
          {FAQ.map(([q, a]) => (
            <div className={styles.faqBand} key={q}>
              <div className={`${styles.wrap} ${styles.faqRow}`}>
                <h3 data-reveal>{q}</h3>
                <p data-reveal style={d(80)}>{a}</p>
              </div>
            </div>
          ))}
        </section>

        <section className={styles.cta} aria-labelledby="cta-title">
          <div className={`${styles.wrap} ${styles.ctaGrid}`}>
            <div className={styles.ctaText}>
              <h2 id="cta-title" className={styles.head} data-reveal>Thêm một đồng đội.<br />Nhẹ một ngày bán hàng.</h2>
              <p className={styles.lead} data-reveal style={d(90)}>Tendly soạn nháp cho mọi kênh, shop chỉ việc đọc và duyệt. Để bạn dành nhiều sự chú ý hơn cho khách hàng.</p>
              <Link className={styles.btn} href="/dang-nhap" data-reveal style={d(160)}>Bắt đầu sử dụng</Link>
            </div>
            <figure className={styles.ctaPhoto}>
              <div className={styles.ctaShutter} data-shutter>{photo('shop-approve.webp', 'Bàn tay chủ shop chạm máy tính bảng để duyệt nội dung')}</div>
              <figcaption className={styles.ctaChip}>Đã duyệt · sẵn sàng gửi</figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footCols}>
            <p><Image className={styles.footLogo} unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} loading="lazy" /><span>Đồng đội AI cho shop online.</span></p>
            <nav aria-label="Chân trang">
              <strong>Trang</strong>
              <a href="#san-pham">Sản phẩm</a>
              <a href="#cach-hoat-dong">Cách hoạt động</a>
              <a href="#hoi-dap">Hỏi đáp</a>
              <Link href="/pricing">Bảng giá</Link>
            </nav>
            <p><strong>Tài khoản</strong><Link href="/dang-nhap">Đăng nhập</Link><Link href="/dang-ky">Đăng ký</Link></p>
            <p><strong>Kênh</strong><span>Facebook Messenger</span><span>Zalo</span><span>TikTok</span><span>Shopee</span></p>
          </div>
          <small>© 2026 Tendly.</small>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
