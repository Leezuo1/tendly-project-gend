'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent } from 'react';

/** Roving focus keeps both demo tab lists usable without a mouse. */
function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number, total: number, select: (index: number) => void) {
  let next: number | undefined;
  if (event.key === 'ArrowRight') next = (index + 1) % total;
  if (event.key === 'ArrowLeft') next = (index + total - 1) % total;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = total - 1;
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}

export function LandingNavigation() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header>
      <nav className="tl-nav tl-wrap" aria-label="Điều hướng chính">
        <Link className="tl-brand" href="/" onClick={close} aria-label="Tendly — Trang chủ">
          <img src="/tendly-logo.png" width="950" height="371" alt="Tendly" />
        </Link>
        <div className={`tl-nav-links${open ? ' tl-open' : ''}`} id="landing-nav-links">
          <a href="#features" onClick={close}>Tính năng</a>
          <a href="#care" onClick={close}>AI hỗ trợ khách</a>
          <a href="#marketing" onClick={close}>Soạn bài AI</a>
          <a href="#how" onClick={close}>Cách hoạt động</a>
          <Link href="/pricing" onClick={close}>Bảng giá</Link>
        </div>
        <Link href="/tong-quan" className="tl-nav-action">Đăng ký / Đăng nhập <span aria-hidden="true">↗</span></Link>
        <button type="button" className="tl-menu-toggle" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-controls="landing-nav-links" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
          {open ? 'Đóng' : 'Menu'}
        </button>
      </nav>
    </header>
  );
}

const conversations = [
  { id: 'trang', kind: 'urgent', name: 'Trang Nguyễn', initial: 'T', avatar: 'pink', time: '2 phút', message: 'Đơn của mình chưa giao, shop kiểm tra giúp nhé?', label: 'Phân tích cảm xúc của Trang', state: 'Lo lắng · Ưu tiên cao', reply: 'Khách cần nhận áo trước chuyến đi và đang lo đơn giao trễ. Nên để nhân viên hỗ trợ trực tiếp: xin mã đơn, kiểm tra tình trạng giao hàng rồi phản hồi khách.' },
  { id: 'khanh', kind: 'auto', name: 'Khánh Dương', initial: 'K', avatar: 'green', time: '14 phút', message: 'Áo polo màu xám còn size L không shop ơi?', label: 'Gợi ý trả lời cho Khánh', state: 'Theo sản phẩm & FAQ', reply: 'Dạ sản phẩm này có size L và màu xám, tổng tồn kho hiện còn hàng. Shop sẽ kiểm tra đúng phiên bản bạn cần trước khi xác nhận nhé.' },
  { id: 'linh', kind: 'auto', name: 'Linh Phạm', initial: 'L', avatar: '', time: '28 phút', message: 'Shop có giao hỏa tốc quận 1 chiều nay không?', label: 'Gợi ý trả lời cho Linh', state: 'Theo FAQ giao hàng mẫu', reply: 'Dạ shop có hỗ trợ giao hỏa tốc tại quận 1. Bạn cho shop địa chỉ và sản phẩm muốn đặt để shop kiểm tra phí giao và thời gian cụ thể nhé.' },
];
const filters = [
  { kind: 'all', label: 'Tất cả', count: 3 },
  { kind: 'urgent', label: 'Cần bạn hỗ trợ', count: 1 },
  { kind: 'auto', label: 'Có gợi ý AI', count: 2 },
];

export function InboxDemo() {
  const [filter, setFilter] = useState(0);
  const [selected, setSelected] = useState('khanh');
  const conversation = conversations.find(item => item.id === selected)!;
  function selectFilter(index: number) {
    setFilter(index);
    const kind = filters[index].kind;
    if (kind !== 'all' && conversation.kind !== kind) setSelected(conversations.find(item => item.kind === kind)!.id);
  }
  return (
    <div className="tl-product-scene" id="inbox-demo">
      <div className="tl-scene-label"><span>Một ngày ở shop của bạn</span><span>Hộp thư minh họa / 01</span></div>
      <div className="tl-inbox">
        <div className="tl-app-top"><strong>Hộp thư đa kênh</strong><span className="tl-status"><span className="tl-dot" aria-hidden="true" /> AI hỗ trợ trả lời</span></div>
        <div className="tl-app-tabs" role="tablist" aria-label="Lọc hội thoại minh họa">
          {filters.map((item, index) => (
            <button key={item.kind} type="button" className="tl-app-tab" id={`inbox-tab-${index}`} role="tab" aria-selected={filter === index} aria-controls="inbox-panel" tabIndex={filter === index ? 0 : -1} onClick={() => selectFilter(index)} onKeyDown={event => moveTab(event, index, filters.length, selectFilter)}>
              {item.label} <small>{item.count}</small>
            </button>
          ))}
        </div>
        <div id="inbox-panel" role="tabpanel" aria-labelledby={`inbox-tab-${filter}`} tabIndex={0}>
          {conversations.map(item => (
            <button key={item.id} type="button" className={`tl-thread${selected === item.id ? ' tl-selected' : ''}`} hidden={filter !== 0 && item.kind !== filters[filter].kind} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
              <span className={`tl-avatar ${item.avatar ? `tl-${item.avatar}` : ''}`}>{item.initial}</span>
              <span className="tl-thread-copy">
                <span className="tl-thread-line"><strong>{item.name}</strong><span>{item.time}</span></span>
                <span className="tl-thread-preview">{item.message}</span>
                <span className="tl-thread-meta"><span>Đa kênh</span><span className={`tl-tag${item.kind === 'urgent' ? ' tl-urgent' : ''}`}>{item.kind === 'urgent' ? 'Cần bạn hỗ trợ' : 'Có gợi ý AI'}</span></span>
              </span>
            </button>
          ))}
        </div>
        <div className="tl-reply" aria-live="polite" aria-atomic="true"><div className="tl-reply-label"><span>{conversation.label}</span><span>{conversation.state}</span></div><p>{conversation.reply}</p></div>
      </div>
      <div className="tl-scene-caption"><span>Chọn một hội thoại để xem cách Tendly hỗ trợ.</span><span className="tl-caption-line" /></div>
      <div className="tl-scene-note">Bớt sót tin. Thêm yên tâm.</div>
    </div>
  );
}

const postDrafts = [
  { title: 'Một chiếc polo cho ngày nhẹ nhàng.', text: 'Chất cotton thoáng mát, dễ phối cùng jeans hay quần vải. Áo polo của shop có giá 249.000đ — nhắn shop để được tư vấn màu và size phù hợp nhé.' },
  { title: 'Hôm nay mặc gì? Thử một chiếc polo nhé.', text: 'Đi làm hay đi cà phê, một chiếc polo cotton luôn dễ phối. Giá 249.000đ. Bạn thích màu nào và thường mặc size gì? Nhắn shop để được tư vấn trước khi chọn nhé.' },
  { title: 'Thêm một lựa chọn cho tủ đồ mỗi ngày.', text: 'Áo polo cotton của shop: thoáng mát, dễ kết hợp và phù hợp nhiều dịp. Giá 249.000đ. Liên hệ shop để kiểm tra màu, size và tình trạng hàng bạn muốn đặt.' },
];

export function PostDemo() {
  const [selected, setSelected] = useState(0);
  const draft = postDrafts[selected];
  return (
    <div className="tl-conversation" id="post-demo">
      <span className="tl-composer-kicker">Soạn bài AI / Nội dung minh họa</span>
      <p className="tl-composer-source"><strong>Sản phẩm:</strong> Áo polo cotton · 249.000đ<br /><strong>Kênh:</strong> Facebook · <strong>Mục tiêu:</strong> Giới thiệu sản phẩm<br /><strong>Giọng văn:</strong> Gần gũi</p>
      <div className="tl-composer-tabs" role="tablist" aria-label="Phương án bài viết minh họa">
        {postDrafts.map((_, index) => (
          <button key={index} type="button" className="tl-composer-tab" id={`post-tab-${index}`} role="tab" aria-selected={selected === index} aria-controls="post-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => moveTab(event, index, postDrafts.length, setSelected)}>
            Phương án {index + 1}
          </button>
        ))}
      </div>
      <div className="tl-post-draft" id="post-panel" role="tabpanel" aria-labelledby={`post-tab-${selected}`} aria-live="polite" aria-atomic="true" tabIndex={0}><h3>{draft.title}</h3><p>{draft.text}</p><p className="tl-post-tags">#AoPolo #Cotton #TendlyShop</p></div>
      <div className="tl-composer-footer"><span>Bản nháp · Có thể chỉnh sửa</span><strong>Xem lại → Lưu nháp → Đăng Fanpage</strong></div>
    </div>
  );
}

export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById('landing-root');
    const header = root?.querySelector('header');
    if (!root || !header) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    if (!reducedMotion.matches && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('tl-visible');
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0.08 });
      const groups = [
        ['.hero-top, .hero h1, .hero-copy, .hero-actions, .hero-note, .hero-foot', 'up'],
        ['.product-scene', 'right'], ['.promise-item', 'up'],
        ['.section-heading > *, .care > div:first-child', 'up'],
        ['.note-board', 'left'], ['.feature-list article, .step, .how-bottom', 'up'],
        ['.conversation', 'scale'], ['.faq > div, .closing-inner > *', 'up'],
      ];
      groups.forEach(([selector, direction]) => {
        root.querySelectorAll<HTMLElement>(selector.replace(/\.([a-zA-Z][\w-]*)/g, '.tl-$1')).forEach((element, index) => {
          element.dataset.reveal = direction;
          element.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 70}ms`);
          observer?.observe(element);
        });
      });
      root.classList.add('tl-motion-ready');
    }
    const disableMotion = () => {
      if (reducedMotion.matches) { root.classList.remove('tl-motion-ready'); observer?.disconnect(); }
    };
    reducedMotion.addEventListener('change', disableMotion);
    let frame = 0;
    const update = () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      (header as HTMLElement).style.setProperty('--scroll-progress', String(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0));
      frame = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
    return () => {
      observer?.disconnect();
      root.classList.remove('tl-motion-ready');
      reducedMotion.removeEventListener('change', disableMotion);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
