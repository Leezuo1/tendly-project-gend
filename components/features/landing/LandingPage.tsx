import Link from 'next/link';
import { InboxDemo, LandingNavigation, LandingMotion, PostDemo } from './LandingExperience';
import styles from './landing.module.css';

export function LandingPage() {
  return (
    <div className={styles.root} id="landing-root">
      <a className="tl-skip-link" href="#home">Đến nội dung chính</a>
      <LandingNavigation />
  <main id="home">
    <section className="tl-hero tl-wrap" aria-labelledby="hero-title">
      <div className="tl-hero-top tl-eyebrow"><span className="tl-dot" aria-hidden="true"></span> Hộp thư · Trợ lý AI · Marketing</div>
      <div className="tl-hero-grid">
        <div>
          <h1 id="hero-title" lang="en">Your AI teammate<br />for every<br /><em className="tl-serif">customer.</em></h1>
          <p className="tl-hero-copy">Một người đồng đội AI, đồng hành cùng shop trên các nền tảng mạng xã hội. Hiểu cảm xúc khách hàng, gợi ý trả lời từ sản phẩm và FAQ, rồi cùng bạn soạn nội dung bán hàng — ngay trong Tendly.</p>
          <div className="tl-hero-actions"><Link className="tl-button tl-coral" href="/tong-quan">Bắt đầu với Tendly <span className="tl-arrow" aria-hidden="true">↗</span></Link><a className="tl-text-link" href="#inbox-demo">Thử hộp thư mẫu</a></div>
          <p className="tl-hero-note">Bạn xem lại, chỉnh sửa và quyết định nội dung gửi cho khách.</p>
          <div className="tl-hero-foot"><span>Một nơi để làm việc.</span><span className="tl-channel-word">Đa kênh</span><span className="tl-channel-word">Cấu hình AI</span><span className="tl-channel-word">Marketing</span></div>
        </div>
        <InboxDemo />
      </div>
      <div className="tl-promise"><div className="tl-promise-item"><span className="tl-num">01</span><div><strong>Chăm sóc khách hàng đa kênh</strong><p>Đọc hội thoại, xem lịch sử và trả lời khách.</p></div></div><div className="tl-promise-item"><span className="tl-num">02</span><div><strong>AI hiểu thông tin shop</strong><p>Gợi ý từ sản phẩm, tồn kho và FAQ đã lưu.</p></div></div><div className="tl-promise-item"><span className="tl-num">03</span><div><strong>Soạn bài & đăng Fanpage</strong><p>Tạo nội dung, sửa bản nháp rồi đăng bài.</p></div></div></div>
    </section>
    <section className="tl-section tl-wrap" id="features" aria-labelledby="features-title">
      <div className="tl-section-heading"><div><span className="tl-eyebrow">Hộp thoại & cấu hình AI</span><h2 id="features-title">Đọc tin, hiểu câu hỏi.<br />Có sẵn gợi ý để trả lời.</h2></div><p>Hộp thư để xử lý hội thoại. Sản phẩm và FAQ để AI có thông tin. Mỗi tính năng giải quyết một việc cụ thể của shop.</p></div>
      <div className="tl-feature-layout">
        <div className="tl-note-board"><div className="tl-board-heading">NGUỒN THÔNG TIN CỦA AI / VÍ DỤ</div><div className="tl-paper-note"><span className="tl-eyebrow">Cấu hình AI của shop</span><h3>Trả lời có căn cứ.</h3><div className="tl-list-row"><span>01</span> Giá, size, màu, tổng tồn kho <span className="tl-tag">Sản phẩm</span></div><div className="tl-list-row"><span>02</span> Giao hàng, đổi trả <span className="tl-tag">FAQ</span></div><div className="tl-list-row"><span>03</span> Câu hỏi thử của chủ shop <span className="tl-tag">Thử hỏi AI</span></div></div><div className="tl-board-footer"><span className="tl-dot" aria-hidden="true"></span> Thông tin đã lưu được dùng từ câu hỏi tiếp theo.</div></div>
        <div className="tl-feature-list"><article><h3><span>01</span>Một hộp thư cho các kênh của shop</h3><p>Quản lý hội thoại từ các nền tảng mạng xã hội trong một không gian làm việc. Xem lịch sử, theo dõi tin cần trả lời và phản hồi khách ngay trong Tendly.</p></article><article><h3><span>02</span>Phân tích AI ngay trong hội thoại</h3><p>Bấm Phân tích AI để xem cảm xúc, mức ưu tiên, lý do và gợi ý phản hồi. Bạn có thể gửi gợi ý với tư cách Shop hoặc chỉnh sửa trước khi gửi.</p></article><article><h3><span>03</span>Sản phẩm & FAQ làm nguồn trả lời</h3><p>Nhập danh mục bằng CSV, cập nhật giá, chất liệu, size, màu và tổng tồn kho. Thêm hoặc bật/tắt FAQ về chính sách shop; dùng Thử hỏi AI để kiểm tra câu trả lời.</p></article><Link className="tl-root-link" href="/cau-hinh-ai">Thiết lập sản phẩm & FAQ ↗</Link></div>
      </div>
    </section>
    <section className="tl-section tl-how" id="how" aria-labelledby="how-title"><div className="tl-wrap">
      <div className="tl-section-heading"><div><span className="tl-eyebrow">Từ dữ liệu đến công việc mỗi ngày</span><h2 id="how-title">Thêm thông tin shop.<br />Dùng AI đúng việc bạn cần.</h2></div><p>Cùng nguồn sản phẩm và FAQ cho việc tư vấn khách lẫn soạn nội dung bán hàng.</p></div>
      <div className="tl-steps"><article className="tl-step"><span className="tl-step-number">01</span><h3>Chuẩn bị sản phẩm & FAQ</h3><p>Nhập danh mục CSV, lưu giá và tồn kho, bổ sung chính sách. Kiểm tra nguồn thông tin bằng ô Thử hỏi AI.</p></article><article className="tl-step"><span className="tl-step-number">02</span><h3>Xử lý tin nhắn của khách</h3><p>Chọn hội thoại từ kênh đã kết nối và phân tích AI. Đọc lý do ưu tiên, sửa gợi ý nếu cần rồi gửi trả lời.</p></article><article className="tl-step"><span className="tl-step-number">03</span><h3>Soạn nội dung marketing</h3><p>Chọn sản phẩm, kênh, mục tiêu và giọng văn. Nhận phương án AI, sửa nội dung, lưu nháp hoặc đăng Fanpage đã kết nối.</p></article></div>
      <div className="tl-how-bottom"><span>Bạn có thể cập nhật thông tin và cách trả lời bất cứ lúc nào.</span><a href="#inbox-demo">Xem hộp thư mẫu <span aria-hidden="true">↗</span></a></div>
    </div></section>
    <section className="tl-section tl-wrap tl-care" id="care" aria-labelledby="care-title">
      <div><span className="tl-eyebrow">Phân tích cảm xúc & mức ưu tiên</span><h2 id="care-title">Biết khách đang lo.<br />Biết ai cần <em className="tl-serif">trả lời trước.</em></h2><p>AI phân biệt cảm xúc tích cực, trung lập, lo lắng, thất vọng và tức giận. Mỗi phân tích có mức ưu tiên, lý do và đề xuất nhân viên hỗ trợ — để bạn chọn cách phản hồi phù hợp.</p><Link className="tl-text-link" href="/hop-thoai">Mở hộp thoại của shop <span aria-hidden="true">↗</span></Link></div>
      <div className="tl-conversation"><div className="tl-conversation-head"><span className="tl-avatar tl-pink">T</span><div><strong>Trang Nguyễn</strong><p>Tin nhắn khách · Tình huống minh họa</p></div></div><div className="tl-bubble">Mình đặt áo để đi du lịch mà giờ vẫn chưa nhận được. Shop kiểm tra giúp mình với nhé.</div><div className="tl-message-time">Tin khách · 14:32</div><div className="tl-bubble tl-answer">Dạ shop hiểu bạn đang cần áo cho chuyến đi. Bạn cho shop mã đơn để mình kiểm tra tình trạng giao hàng và hỗ trợ nhé.</div><div className="tl-message-time tl-right">Gợi ý AI · Bạn xem lại trước khi gửi</div><div className="tl-handoff"><span className="tl-dot" aria-hidden="true"></span><span>Lo lắng · Ưu tiên cao · Nên để nhân viên hỗ trợ</span></div></div>
    </section>
    <section className="tl-section tl-wrap tl-care tl-marketing" id="marketing" aria-labelledby="marketing-title">
      <div><span className="tl-eyebrow">Marketing · Soạn bài AI</span><h2 id="marketing-title">Từ sản phẩm của shop<br />đến một bài viết <em className="tl-serif">sẵn để sửa.</em></h2><p>Chọn Facebook, TikTok hoặc Email; thêm mục tiêu, giọng văn và tối đa 5 sản phẩm. AI tạo 1–3 phương án với tiêu đề, nội dung, hashtag và gợi ý hình ảnh hoặc video.</p><p style={{ marginTop: 16 }}>Sửa trực tiếp, lưu bản nháp hoặc sao chép nội dung. Với Facebook Page đã kết nối, bạn có thể lưu và đăng bài ngay từ Tendly.</p><Link className="tl-text-link" href="/marketing">Mở công cụ soạn bài <span aria-hidden="true">↗</span></Link></div>
      <PostDemo />
    </section>
    <section className="tl-wrap tl-faq" aria-labelledby="faq-title"><div><span className="tl-eyebrow">Hiểu rõ trước khi bắt đầu</span><h2 id="faq-title">Tendly làm được gì?</h2></div><div><details><summary>AI dựa vào đâu để tư vấn sản phẩm?</summary><p>Từ danh mục sản phẩm, giá, chất liệu, size, màu, tổng tồn kho và FAQ đang bật mà bạn đã lưu trong Cấu hình AI. Bạn có thể thử câu hỏi ngay tại ô Thử hỏi AI để xem cảm xúc, mức ưu tiên và phản hồi.</p></details><details><summary>Tendly hỗ trợ những kênh nào?</summary><p>Tendly hướng đến một không gian chăm sóc khách hàng đa kênh trên các nền tảng mạng xã hội. Hiện tính năng nhận và gửi tin nhắn hỗ trợ Messenger khi Facebook Page được kết nối và cấu hình đầy đủ. Zalo và TikTok nằm trong kế hoạch tích hợp tiếp theo.</p></details><details><summary>AI có thể soạn và đăng bài lên kênh nào?</summary><p>AI soạn nội dung cho Facebook, TikTok và Email. Bạn sửa, lưu nháp hoặc sao chép; đăng trực tiếp hiện hỗ trợ Facebook Fanpage đã kết nối. Nội dung TikTok và Email được sao chép để sử dụng trên kênh tương ứng.</p></details><details><summary>Tendly đã tự gửi email chăm sóc khách chưa?</summary><p>Bạn có thể cấu hình các kịch bản email làm thông tin tham khảo cho AI. Việc tự gửi email thực tế chưa được tích hợp. Phần soạn bài Email giúp tạo nội dung để bạn xem lại và sao chép.</p></details><details><summary>Mình có thể thử gì trên trang này?</summary><p>Lọc hộp thư, chọn hội thoại để xem phân tích hoặc gợi ý trả lời và chuyển giữa các phương án bài viết mẫu. Dữ liệu ở phần minh họa là ví dụ. Chọn Bắt đầu với Tendly để mở không gian làm việc của shop.</p></details></div></section>
    <section className="tl-closing" id="start"><div className="tl-wrap tl-closing-inner"><div><h2>Trả lời khách có căn cứ.<br />Soạn nội dung <em className="tl-serif">có người phụ.</em></h2><p>Bắt đầu với sản phẩm, FAQ và những cuộc trò chuyện của shop.</p></div><div className="tl-closing-action"><Link className="tl-button" href="/tong-quan">Đăng ký / Đăng nhập <span className="tl-arrow" aria-hidden="true">↗</span></Link><p>Hộp thư đa kênh · Gợi ý AI · Soạn bài bán hàng</p></div></div></section>
  </main>
  <footer><div className="tl-wrap tl-footer-inner"><div className="tl-footer-brand"><Link className="tl-brand" href="/"><img src="/tendly-logo.png" width="950" height="371" alt="Tendly" /></Link><p>Chăm khách chu đáo.<br />Bán hàng thảnh thơi.</p></div><div className="tl-footer-links"><a href="#features">Sản phẩm</a><a href="#how">Cách hoạt động</a><Link href="/pricing">Bảng giá</Link><Link href="/cai-dat">Cài đặt shop</Link></div><small>© 2026 Tendly</small></div></footer>
      <LandingMotion />
    </div>
  );
}
