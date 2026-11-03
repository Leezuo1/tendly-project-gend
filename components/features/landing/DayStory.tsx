'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './landing.module.css';

const img = (src: string, alt: string) => (
  <Image unoptimized src={`/landing/story/${src}`} alt={alt} width={640} height={640} loading="lazy" decoding="async" />
);

type Chapter = {
  time: string; name: string; title: string; text: string;
  tone: 'sand' | 'peach' | 'dark';
  variant: 'a' | 'pair' | 'live' | 'tiles';
  visual: ReactNode; card: ReactNode;
};

// Inside the active chapter, each [data-at] beat appears once reading progress passes its value (0–1).
const CHAPTERS: Chapter[] = [
  {
    time: '08:00', name: 'Tìm nguồn', tone: 'sand', variant: 'a',
    title: 'Sáng sớm, tìm mẫu mới.',
    text: 'Smart Sourcing so chất liệu, MOQ và nhà cung cấp, rồi lưu nguồn phù hợp để shop liên hệ.',
    visual: <>{img('cotton-detail.webp', 'Cận chất vải cotton pique navy')}<span className={styles.cvLabel}>Cotton pique · 2 màu · 4 size</span></>,
    card: (
      <>
        <p className={styles.appBar}><b>Smart Sourcing</b><span>Thời trang Mộc</span></p>
        <p className={styles.query} data-at={0}>Tìm: polo cotton co giãn, form regular</p>
        <div className={styles.supplier} data-at={0.2}>{img('shop-rack.webp', 'Kệ áo polo mẫu của nhà cung cấp')}<p><b>Nhà cung cấp An Nhiên</b><span>TP. Hồ Chí Minh</span></p><p className={styles.moq}><span>MOQ</span><b>50 áo</b></p></div>
        <p className={styles.aiNote} data-at={0.42}><b>Gợi ý từ Tendly</b>MOQ thấp, đúng chất vải shop đang bán.</p>
        <span className={styles.chip} data-final="true" data-at={0.62}>Đã lưu vào danh sách nguồn</span>
      </>
    ),
  },
  {
    time: '10:24', name: 'Chăm sóc khách', tone: 'sand', variant: 'a',
    title: 'Mỗi câu hỏi đều được trả lời chu đáo.',
    text: 'Lan Anh hỏi size trên Messenger. Tendly soạn nháp theo bảng size, shop đọc lại rồi bấm gửi.',
    visual: <>{img('navy-polo.webp', 'Áo polo navy, form regular')}<span className={styles.cvLabel}>Polo Essential · Cotton · Regular fit</span></>,
    card: (
      <>
        <p className={styles.appBar}><b>Messenger</b><span>Lan Anh</span></p>
        <div className={styles.msgIn} data-at={0}><span className={styles.avatar}>LA</span><p>Áo polo này có size L không ạ? Mình cao 1m72, nặng 68kg.</p></div>
        <div className={styles.aiDraft} data-at={0.22}>
          <p className={styles.aiHead}><b>Nháp từ Tendly</b><small>Nguồn: bảng size</small></p>
          <p>Dạ có size L ạ. Với 1m72 và 68kg, bạn mặc size L sẽ vừa thoải mái.</p>
        </div>
        <p className={styles.sendBtn} data-at={0.5}><span>Duyệt & gửi</span><span>Đã gửi lúc 10:26</span></p>
      </>
    ),
  },
  {
    time: '14:00', name: 'Tư vấn', tone: 'sand', variant: 'pair',
    title: 'Hiểu điều khách cần, tư vấn điều phù hợp.',
    text: 'Trên Zalo, Tendly so màu, size và tồn kho để shop gợi ý đúng mẫu cho từng khách.',
    visual: (
      <>
        <figure>{img('navy-polo.webp', 'Áo polo màu navy')}<figcaption><b>Navy</b> · Còn 4 áo</figcaption></figure>
        <figure>{img('beige-polo.webp', 'Áo polo màu be')}<figcaption><b>Be</b> · Còn 2 áo</figcaption></figure>
      </>
    ),
    card: (
      <>
        <p className={styles.appBar}><b>Zalo</b><span>Minh Hoàng</span></p>
        <div className={styles.msgIn} data-at={0}><span className={styles.avatar}>MH</span><p>Mình cần áo đi làm, dễ phối, mặc thoải mái.</p></div>
        <p className={styles.aiNote} data-at={0.3}><b>Gợi ý từ Tendly</b>Polo navy, size L. Dễ phối cùng quần kaki cho ngày đi làm.</p>
        <span className={styles.chip} data-final="true" data-at={0.58}>Shop đã gửi gợi ý</span>
      </>
    ),
  },
  {
    time: '20:00', name: 'Livestream', tone: 'peach', variant: 'live',
    title: 'Bạn giữ nhịp live, Tendly theo nhịp khách.',
    text: 'Bình luận dồn dập trên TikTok. Tendly gom câu hỏi trùng và lên đơn nháp cho từng khách chốt.',
    visual: (
      <>
        {img('live-host.webp', 'Chủ shop giới thiệu áo polo navy trong buổi livestream')}
        <span className={`${styles.cvLabel} ${styles.onAir}`}>Đang live · Thời trang Mộc</span>
        <ul className={styles.comments}>
          <li data-at={0}><b>Lan Anh</b> Còn size L không shop?</li>
          <li data-at={0.12}><b>Minh Hoàng</b> Mình lấy navy L nhé!</li>
          <li data-at={0.24}><b>Thảo Nguyên</b> Cho em một áo L ạ.</li>
        </ul>
      </>
    ),
    card: (
      <>
        <p className={styles.aiNote} data-at={0.36}><b>Tendly gom lại</b>3 khách cùng hỏi size L.</p>
        <div className={styles.order} data-at={0.5}>{img('navy-polo.webp', 'Áo polo navy trong đơn nháp')}<p><b>Đơn nháp #TD024</b>Navy · L · 289.000đ</p></div>
        <p className={styles.sendBtn} data-at={0.7}><span>Xác nhận đơn</span><span>Shop đã xác nhận</span></p>
      </>
    ),
  },
  {
    time: '21:30', name: 'Marketing', tone: 'dark', variant: 'tiles',
    title: 'Từ sản phẩm quen thuộc đến một góc kể mới.',
    text: 'Từ mẫu bán chạy, Tendly soạn bài Facebook đúng giọng của shop và lên lịch đăng.',
    visual: (
      <>
        <figure data-at={0}>{img('cotton-detail.webp', 'Cận chất cotton của áo polo')}<figcaption>Chất vải</figcaption></figure>
        <figure data-at={0.1}>{img('office-style.webp', 'Phối polo navy đi làm')}<figcaption>Đi làm</figcaption></figure>
        <figure data-at={0.2}>{img('shop-rack.webp', 'Bộ sưu tập polo trong shop')}<figcaption>Phối đồ</figcaption></figure>
      </>
    ),
    card: (
      <>
        <p className={styles.appBar}><b>Facebook</b><span>Bài viết mới</span></p>
        <p className={styles.post} data-at={0.32}>Đi làm gọn gàng, cuối ngày vẫn thoải mái. <b>Polo cotton co giãn, cho nhịp sống của bạn.</b></p>
        <span className={styles.chip} data-final="true" data-at={0.6}>Đã lên lịch · 8:00 sáng mai</span>
      </>
    ),
  },
  {
    time: '22:00', name: 'Email sau mua', tone: 'dark', variant: 'a',
    title: 'Giữ liên lạc sau đơn hàng.',
    text: 'Đơn đã xác nhận, Tendly gửi lời cảm ơn đúng sản phẩm khách vừa mua.',
    visual: <>{img('office-style.webp', 'Khách mặc polo navy đi làm')}<span className={styles.cvLabel}>Lan Anh · Polo navy size L</span></>,
    card: (
      <>
        <p className={styles.appBar}><b>Email</b><span>Gửi đến Lan Anh</span></p>
        <p className={styles.mailTitle} data-at={0}>Cảm ơn bạn đã chọn Mộc.</p>
        <div className={styles.order} data-at={0.2}>{img('navy-polo.webp', 'Polo navy trong email cảm ơn')}<p><b>Polo Essential</b>Navy · Size L</p></div>
        <span className={styles.chip} data-final="true" data-at={0.46}>Đã gửi sau khi xác nhận đơn</span>
      </>
    ),
  },
];

function Canvas({ c, active }: { c: Chapter; active?: boolean }) {
  return (
    <div className={styles.cv} data-variant={c.variant} data-active={active}>
      <div className={styles.cvVisual}>{c.visual}</div>
      <div className={styles.cvCard} data-ui>{c.card}</div>
    </div>
  );
}

export function DayStory() {
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const wide = matchMedia('(min-width: 961px)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setLive(wide.matches && !reduce.matches);
    sync();
    wide.addEventListener('change', sync);
    reduce.addEventListener('change', sync);
    return () => { wide.removeEventListener('change', sync); reduce.removeEventListener('change', sync); };
  }, []);

  useEffect(() => {
    const sec = ref.current;
    const stage = stageRef.current;
    if (!sec || !stage) return;
    const articles = Array.from(sec.querySelectorAll<HTMLElement>('[data-chapter]'));
    const canvases = Array.from(stage.querySelectorAll<HTMLElement>('[data-variant]'));
    if (!live) {
      sec.querySelectorAll('[data-at]').forEach(el => el.setAttribute('data-on', ''));
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.55;
      let idx = 0;
      articles.forEach((a, i) => { if (a.getBoundingClientRect().top < line) idx = i; });
      const r = articles[idx].getBoundingClientRect();
      const lp = Math.min(1, Math.max(0, (line - r.top) / r.height));
      const s = sec.getBoundingClientRect();
      sec.style.setProperty('--rail', String(Math.min(1, Math.max(0, (line - s.top) / s.height))));
      stage.style.setProperty('--lp', lp.toFixed(3));
      setActive(idx);
      canvases.forEach((c, i) => c.querySelectorAll<HTMLElement>('[data-at]').forEach(el => {
        el.toggleAttribute('data-on', i < idx || (i === idx && lp >= Number(el.dataset.at) * 0.85));
      }));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
  }, [live]);

  const goTo = (i: number) => {
    const a = ref.current?.querySelectorAll<HTMLElement>('[data-chapter]')[i];
    if (a) scrollTo({ top: a.getBoundingClientRect().top + scrollY - innerHeight * 0.3, behavior: 'smooth' });
  };

  return (
    <section ref={ref} id="san-pham" className={styles.story} data-live={live || undefined} aria-labelledby="story-title">
      <div className={styles.storyHead}>
        <h2 id="story-title" className={styles.head} data-reveal>Nhiều việc trong ngày.<br />Một đồng đội xuyên suốt.</h2>
        <p className={styles.lead} data-reveal>Một ngày bán hàng của Thời trang Mộc, từ sáng sớm đến lúc đóng shop.</p>
      </div>
      <div className={styles.storyGrid}>
        <div className={styles.rail} aria-hidden="true"><i /></div>
        <div className={styles.chapters}>
          {CHAPTERS.map((c, i) => (
            <article key={c.time} data-chapter={i} className={styles.chapter} data-current={live && i === active ? true : undefined}>
              <p className={styles.clock}>{c.time}</p>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <div className={styles.inlineCanvas}><Canvas c={c} /></div>
            </article>
          ))}
        </div>
        <div className={styles.stage} ref={stageRef} data-tone={CHAPTERS[active].tone} style={{ '--n': CHAPTERS.length } as CSSProperties}>
          <div className={styles.stageTop}>
            <b>{CHAPTERS[active].name}</b>
            <nav aria-label="Các mốc trong ngày">
              {CHAPTERS.map((c, i) => (
                <button key={c.time} type="button" aria-label={`${c.time} ${c.name}`} aria-current={i === active ? 'step' : undefined} onClick={() => goTo(i)}>{c.time}</button>
              ))}
            </nav>
          </div>
          <div className={styles.stageBody}>
            {CHAPTERS.map((c, i) => <Canvas key={c.time} c={c} active={i === active} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
