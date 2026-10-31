import Link from 'next/link';
import { LandingNavigation, LandingMotion } from './LandingExperience';
import styles from './landing.module.css';

export function LandingPage() {
  return (
    <div className={styles.root} id="landing-root">
      <a className="tl-skip-link" href="#home">Đến nội dung chính</a>
      <LandingNavigation />
      
      <main id="home">
        {/* HERO SECTION: Tập trung vào e-commerce và livestream */}
        <section className="tl-hero tl-wrap" aria-labelledby="hero-title">
          <div className="tl-hero-top tl-eyebrow">
            <span className="tl-dot" aria-hidden="true"></span> Trợ lý AI cho E-Commerce & Livestream
          </div>
          <div className="tl-hero-grid">
            <div>
              <h1 id="hero-title">
                Chốt đơn mỏi tay, <br />
                Livestream rối trí? <br />
                <em className="tl-serif">Đã có AI lo.</em>
              </h1>
              <p className="tl-hero-copy">
                Nền tảng AI toàn diện giúp các shop vừa và nhỏ tổng hợp thông tin sản phẩm, tự động soạn nội dung marketing đa kênh (Facebook, TikTok) và đặc biệt là <strong>Trợ lý Livestream</strong> tự động gom đơn, tổng kết phiên stream khúc cuối giờ không sót một khách.
              </p>
              <div className="tl-hero-actions">
                <Link className="tl-button tl-coral" href="/dang-ky">
                  Dùng thử miễn phí <span className="tl-arrow" aria-hidden="true">↗</span>
                </Link>
                <a className="tl-text-link" href="#features">Khám phá tính năng</a>
              </div>
              <div className="tl-hero-foot">
                <span>Tích hợp sẵn:</span>
                <span className="tl-channel-word">Live Summary</span>
                <span className="tl-channel-word">Auto Marketing</span>
                <span className="tl-channel-word">Smart Inbox</span>
              </div>
            </div>

            {/* MOCKUP LIVE DASHBOARD BÊN CẠNH */}
            <div className="tl-live-preview-card">
              <div className="tl-preview-header">
                <span className="tl-live-badge"><span className="tl-dot-pulse"></span> LIVE STREAMING SESSIONS</span>
                <span className="tl-preview-time">Phiên tối nay: 2.400.000đ</span>
              </div>
              <div className="tl-preview-body">
                <div className="tl-preview-metric-row">
                  <div>
                    <small>Tổng đơn chốt qua chat</small>
                    <strong>48 đơn</strong>
                  </div>
                  <div>
                    <small>Khách cần hỗ trợ gấp</small>
                    <strong className="tl-text-coral">2 ca</strong>
                  </div>
                </div>
                <div className="tl-stream-summary-box">
                  <div className="tl-box-tag">Tóm tắt AI phiên stream cuối giờ</div>
                  <p>• Áo polo cotton xám size L là sản phẩm bán chạy nhất (18 chiếc).</p>
                  <p>• Còn 3 bình luận hỏi ship hỏa tốc chưa được chốt đơn.</p>
                </div>
              </div>
              <div className="tl-preview-footer">
                <span>Trợ lý AI đang hoạt động 24/7 cho shop của bạn</span>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES: Chia khối hiện đại */}
        <section className="tl-section tl-wrap" id="features" aria-labelledby="features-title">
          <div className="tl-section-heading">
            <div>
              <h2 id="features-title">
                Mọi công việc của shop <br />
                được thu gọn trong 1 hệ sinh thái.
              </h2>
            </div>
            <p>Không cần mở hàng chục tab hay thuê nhiều nhân sự vận hành. AI tự động hóa từ khâu chuẩn bị đến khi tổng kết doanh thu.</p>
          </div>

          <div className="tl-bento-grid">
            {/* Ô Bento 1: Trợ lý Livestream */}
            <div className="tl-bento-card tl-bento-span-2">
              <div className="tl-bento-tag">TÍNH NĂNG ĐẶC BIỆT</div>
              <h3>Trợ lý Livestream & Tổng hợp đơn khúc cuối</h3>
              <p>Phiên live kết thúc là lúc AI bắt đầu làm việc: tự động quét toàn bộ bình luận, lọc ra các từ khóa chốt đơn, tổng hợp số lượng từng mặt hàng và lập báo cáo doanh thu chi tiết chỉ trong 1 phút.</p>
              <div className="tl-bento-mini-mockup">
                <span>⚡ Tự động gom đơn từ cmt</span>
                <span>📊 Thống kê sản phẩm hot nhất</span>
                <span>🎯 Báo cáo nhanh doanh thu livestream</span>
              </div>
            </div>

            {/* Ô Bento 2: AI Marketing */}
            <div className="tl-bento-card">
              <div className="tl-bento-tag">MARKETING ĐA KÊNH</div>
              <h3>Tự tạo bài viết Facebook, TikTok</h3>
              <p>Chọn sản phẩm từ kho, chọn phong cách, AI sẽ viết sẵn nội dung kèm hashtag chuẩn chỉnh để bạn đăng ngay.</p>
            </div>

            {/* Ô Bento 3: Knowledge Base & FAQ */}
            <div className="tl-bento-card">
              <div className="tl-bento-tag">DỮ LIỆU THÔNG MINH</div>
              <h3>Tổng hợp thông tin & FAQ</h3>
              <p>Upload danh mục, giá, tồn kho. AI nắm rõ như lòng bàn tay để tư vấn khách chuẩn xác không lệch nhịp.</p>
            </div>

            {/* Ô Bento 4: Smart Inbox */}
            <div className="tl-bento-card tl-bento-span-2">
              <div className="tl-bento-tag">HỘP THƯ ĐA KÊNH</div>
              <h3>Phân tích cảm xúc khách hàng & Ưu tiên xử lý</h3>
              <p>Nhận diện ngay khách đang phàn nàn, lo lắng để đẩy lên hàng đầu. Kèm theo gợi ý trả lời thông minh giúp nhân viên bấm gửi trong 1 giây.</p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="tl-section tl-how" id="how" aria-labelledby="how-title">
          <div className="tl-wrap">
            <div className="tl-section-heading">
              <div>
                <h2 id="how-title">
                  Vận hành đơn giản <br />
                  Chỉ với 3 bước cơ bản.
                </h2>
              </div>
              <p>Quy trình tối ưu hóa giúp chủ shop e-commerce bắt đầu ứng dụng AI ngay lập tức mà không cần rành công nghệ.</p>
            </div>
            <div className="tl-steps">
              <article className="tl-step">
                <span className="tl-step-number">01</span>
                <h3>Kết nối kênh bán & Livestream</h3>
                <p>Liên kết Fanpage, TikTok Shop và các nguồn dữ liệu sản phẩm, giá bán, chính sách đổi trả vào hệ thống.</p>
              </article>
              <article className="tl-step">
                <span className="tl-step-number">02</span>
                <h3>AI học dữ liệu & Trợ giúp</h3>
                <p>Hệ thống tự động đồng bộ tồn kho, chuẩn bị sẵn các mẫu câu trả lời và kịch bản marketing theo ý muốn.</p>
              </article>
              <article className="tl-step">
                <span className="tl-step-number">03</span>
                <h3>Thảnh thơi chốt đơn & Nhận báo cáo</h3>
                <p>Tập trung livestream và phát triển sản phẩm, mọi khâu chăm sóc khách, viết bài và tổng kết stream đã có AI lo.</p>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="tl-wrap tl-faq" aria-labelledby="faq-title">
          <div>
            <h2 id="faq-title">Câu hỏi thường gặp</h2>
            <p className="tl-faq-lead">Mọi thắc mắc về cách AI hỗ trợ cho shop e-commerce và livestream.</p>
          </div>
          <div>
            <details>
              <summary>Trợ lý Livestream hoạt động như thế nào?</summary>
              <p>Trợ lý AI sẽ kết nối vào phiên live, tự động đọc các bình luận chứa cú pháp chốt đơn, phân loại sản phẩm khách chọn và xuất ra bảng tổng kết số lượng đơn hàng ngay sau khi tắt máy.</p>
            </details>
            <details>
              <summary>AI soạn bài đăng mạng xã hội có chuẩn không?</summary>
              <p>AI sử dụng đúng dữ liệu sản phẩm thực tế của shop (giá, size, màu, chất liệu) kết hợp với các xu hướng ngôn ngữ mạng xã hội để tạo ra các bài viết tự nhiên, thu hút tương tác cao trên Facebook và TikTok.</p>
            </details>
            <details>
              <summary>Shop nhỏ mới bắt đầu có dễ sử dụng không?</summary>
              <p>Cực kỳ dễ dàng! Bạn chỉ mất chưa đầy 5 phút để nhập thông tin sản phẩm và kết nối các kênh là hệ thống có thể bắt đầu hỗ trợ vận hành ngay lập tức.</p>
            </details>
          </div>
        </section>

        {/* CTA CLOSING */}
        <section className="tl-closing" id="start">
          <div className="tl-wrap tl-closing-inner">
            <div>
              <h2>
                Tối ưu hóa vận hành shop. <br />
                Bán hàng thảnh thơi cùng <em className="tl-serif">Tendly.</em>
              </h2>
              <p>Bắt đầu tự động hóa khâu marketing và tổng hợp đơn livestream ngay hôm nay.</p>
            </div>
            <div className="tl-closing-action">
              <Link className="tl-button" href="/dang-nhap">
                Trải nghiệm miễn phí <span className="tl-arrow" aria-hidden="true">↗</span>
              </Link>
              <p>Livestream Assistant · AI Marketing · Smart Inbox</p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="tl-wrap tl-footer-inner">
          <div className="tl-footer-brand">
            <Link className="tl-brand" href="/">
              <img src="/tendly-logo.png" width="950" height="371" alt="Tendly" />
            </Link>
            <p>Chăm khách chu đáo.<br />Bán hàng thảnh thơi.</p>
          </div>
          <div className="tl-footer-links">
            <a href="#features">Tính năng</a>
            <a href="#how">Cách hoạt động</a>
            <Link href="/pricing">Bảng giá</Link>
          </div>
          <small>© 2026 Tendly</small>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
