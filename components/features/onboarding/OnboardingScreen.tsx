'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { useMockOnboarding } from '@/lib/hooks/useMockOnboarding';
import { industries, avatarOptions, toneOptions } from '@/lib/data/workspace';
import { completeMockOnboarding, connectMockPlatform, saveMockWorkspace, type MockPlatform, type MockWorkspace, type WorkspaceAvatar, type WorkspaceTone } from '@/lib/services/mockOnboarding';
import styles from './onboarding.module.css';

export const platforms: { id: MockPlatform; name: string; description: string }[] = [
  { id: 'messenger', name: 'Messenger', description: 'Gom tin nhắn từ Fanpage về một nơi.' },
  { id: 'zalo', name: 'Zalo', description: 'Kết nối Zalo cá nhân hoặc Zalo OA.' },
  { id: 'tiktok', name: 'TikTok', description: 'Tiếp nối hội thoại với khách trên TikTok.' },
  { id: 'shopee', name: 'Shopee', description: 'Đưa sản phẩm về làm nguồn tư vấn cho AI.' },
];
const timezones = [{ value: 'Asia/Ho_Chi_Minh', label: '(GMT+07:00) Việt Nam' }, { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore' }];

function browserTimezone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

function timezoneLabel(value: string) {
  try {
    const offset = new Intl.DateTimeFormat('vi-VN', { timeZone: value, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value;
    return `(${offset || 'UTC'}) ${value.replaceAll('_', ' ')}`;
  } catch { return value; }
}

export function OnboardingHeader() {
  const { logout } = useAppSecurity();
  const router = useRouter();
  return <header className={styles.header}><Link href="/" aria-label="Tendly — Trang chủ"><img src="/tendly-logo.png" alt="Tendly" width="126" height="42" /></Link><div className={styles.headerRight}><span className={styles.demoBadge}>BẢN DÙNG THỬ</span><span className={styles.adminAvatar}>A</span><span>Admin</span><button type="button" onClick={async () => { try { await logout(); router.replace('/dang-nhap'); } catch { window.alert('Chưa đăng xuất được. Vui lòng thử lại.'); } }}>Đăng xuất</button></div></header>;
}

function Arrow() { return <span aria-hidden="true">↗</span>; }

function PlatformMark({ id }: { id: MockPlatform }) {
  return <span className={`${styles.platformMark} ${styles[id]}`} aria-hidden="true"><img src={`/platforms/${id}.svg`} alt="" width="36" height="36" /></span>;
}

function StepRail({ step }: { step: 'workspace' | 'connections' }) {
  const items = [{ title: 'Tạo không gian của bạn', detail: 'Một nơi dành riêng cho shop.', number: '01' }, { title: 'Kết nối nền tảng', detail: 'Đưa khách hàng về gần hơn.', number: '02' }, { title: 'Sẵn sàng cùng Tendly', detail: 'Bắt đầu từ trang tổng quan.', number: '03' }];
  const current = step === 'workspace' ? 0 : 1;
  return <aside className={styles.rail}><p className={styles.eyebrow}>MỘT KHỞI ĐẦU NHỎ</p><h2>Cùng thiết lập<br />điều <em>tuyệt vời.</em></h2><p className={styles.railDescription}>Chỉ vài bước để Tendly hiểu shop và đồng hành cùng bạn.</p><ol className={styles.steps}>{items.map((item, index) => <li key={item.number} className={index === current ? styles.currentStep : index < current ? styles.doneStep : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? '✓' : item.number}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ol><div className={styles.railNote}><span aria-hidden="true">✳</span><p lang="en">Your AI teammate<br /> for every <em>customer.</em></p></div></aside>;
}

export function OnboardingScreen({ step }: { step: 'workspace' | 'connections' }) {
  const router = useRouter();
  const state = useMockOnboarding();
  useEffect(() => {
    if (!state.ready) return;
    if (!state.authenticated) router.replace('/dang-nhap');
    else if (step === 'connections' && !state.workspace) router.replace('/tao-shop');
  }, [state.ready, state.authenticated, !!state.workspace, step, router]);

  if (!state.ready || !state.authenticated || (step === 'connections' && !state.workspace)) return <main className={styles.loading} role="status">Đang mở không gian của bạn…</main>;
  return <div className={styles.root}><OnboardingHeader /><main className={`${styles.layout} ${step === 'workspace' ? styles.workspaceLayout : styles.connectionsLayout}`}><StepRail step={step} /><section className={styles.content} aria-labelledby="onboarding-title">{step === 'workspace' ? <WorkspaceForm initial={state.workspace} /> : <Connections workspace={state.workspace!} connections={state.connections} />}</section></main><footer className={styles.footer}><span>© {new Date().getFullYear()} Tendly</span><span>Đồng hành cùng shop Việt <span aria-hidden="true">✳</span></span></footer></div>;
}

function WorkspaceForm({ initial }: { initial: MockWorkspace | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || '');
  const [industry, setIndustry] = useState(initial?.industry || '');
  const [detectedTimezone] = useState(browserTimezone);
  const [timezone, setTimezone] = useState(initial?.timezone || detectedTimezone || 'Asia/Ho_Chi_Minh');
  const [timezoneChanged, setTimezoneChanged] = useState(false);
  const [avatar, setAvatar] = useState<WorkspaceAvatar>(initial?.avatar || 'initial');
  const [avatarTone, setAvatarTone] = useState<WorkspaceTone>(initial?.avatarTone || 'coral');
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<{ name?: string; industry?: string; general?: string }>({});
  const timezoneOptions = [...timezones];
  if (!timezoneOptions.some(item => item.value === timezone)) timezoneOptions.push({ value: timezone, label: timezoneLabel(timezone) });
  const autoDetected = !initial?.timezone && !timezoneChanged && detectedTimezone === timezone;
  const avatarSymbol = avatar === 'initial' ? Array.from(name.trim())[0]?.toUpperCase() || 'T' : avatarOptions.find(item => item.value === avatar)!.symbol;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const next = { name: !name.trim() ? 'Bạn đặt tên cho shop trước nhé.' : name.trim().length > 80 ? 'Tên shop tối đa 80 ký tự.' : undefined, industry: !industry ? 'Vui lòng chọn ngành hàng của shop.' : undefined };
    setErrors(next);
    if (next.name || next.industry) { event.currentTarget.querySelector<HTMLElement>(next.name ? '#shop-name' : '#industry')?.focus(); return; }
    startTransition(() => {
      try { saveMockWorkspace({ name, industry, timezone, avatar, avatarTone }); router.push('/ket-noi'); }
      catch { setErrors({ general: 'Không lưu được thông tin. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.' }); }
    });
  }

  return <div className={styles.workspacePanel}><p className={styles.eyebrow}>BƯỚC 1 / 3</p><h1 id="onboarding-title">Thiết lập không gian làm việc</h1><p className={styles.description}>Một nơi dành riêng cho hội thoại, sản phẩm và đội ngũ của bạn.</p><div className={styles.workspaceColumns}><form className={styles.workspaceForm} onSubmit={submit} noValidate aria-busy={isPending}>
    <div className={styles.field}><label htmlFor="shop-name">Tên shop / workspace của bạn là gì? <span>*</span></label><input id="shop-name" value={name} onChange={event => { setName(event.target.value); setErrors(previous => ({ ...previous, name: undefined })); }} placeholder="Ví dụ: Tiệm Nhà Linh" autoComplete="organization" maxLength={80} required aria-invalid={!!errors.name} aria-describedby="shop-name-hint" /><p id="shop-name-hint" className={errors.name ? styles.error : styles.hint}>{errors.name || 'Tên hiển thị trong không gian làm việc của bạn.'}</p></div>
    <div className={styles.field}><label htmlFor="industry">Ngành hàng <span>*</span></label><select id="industry" value={industry} onChange={event => { setIndustry(event.target.value); setErrors(previous => ({ ...previous, industry: undefined })); }} required aria-invalid={!!errors.industry} aria-describedby={errors.industry ? 'industry-error' : undefined}><option value="" disabled>Chọn ngành hàng của shop</option>{industries.map(value => <option key={value}>{value}</option>)}</select>{errors.industry && <p className={styles.error} id="industry-error">{errors.industry}</p>}</div>
    <div className={styles.field}><label htmlFor="timezone">Múi giờ</label><select id="timezone" value={timezone} onChange={event => { setTimezone(event.target.value); setTimezoneChanged(true); }} aria-describedby="timezone-hint">{timezoneOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p id="timezone-hint" className={autoDetected ? styles.detectedTimezone : styles.hint}>{autoDetected ? '✓ Tự động nhận diện từ trình duyệt' : 'Dùng để hiển thị thời gian hội thoại và báo cáo.'}</p></div>
    {errors.general && <p className={styles.error} role="alert">{errors.general}</p>}<button className={styles.primary} type="submit" disabled={isPending}>{isPending ? <><span className={styles.spinner} aria-hidden="true" /> Đang tạo không gian…</> : <>Tạo shop & tiếp tục <Arrow /></>}</button><p className={styles.formNote}>Bạn có thể chỉnh sửa những thông tin này sau.</p>
  </form><aside className={styles.preview} aria-label="Xem trước workspace trực tiếp">
    <div className={styles.previewHeading}><p className={styles.previewLabel}>KHÔNG GIAN CỦA BẠN</p><span><i aria-hidden="true" /> Xem trước</span></div>
    <div className={styles.miniWorkspace}>
      <div className={styles.miniTop}><span className={`${styles.shopAvatar} ${styles[avatarTone]}`} aria-hidden="true">{avatarSymbol}</span><div className={styles.liveIdentity} key={`${name.trim()}-${industry}`}><h3>{name.trim() || 'Shop của bạn'}</h3><span className={styles.industryBadge}>{industry || 'Ngành hàng của shop'}</span></div><span className={styles.miniMenu} aria-hidden="true">···</span></div>
      <div className={styles.miniBody}><div className={styles.miniSidebar} aria-hidden="true"><span className={styles.miniActive}>▦</span><span>☷</span><span>◇</span><span>⚙</span></div><div className={styles.miniMain}><div className={styles.miniTitle}><strong>Tổng quan</strong><span>HÔM NAY</span></div><div className={styles.miniStats}><div><span>Hội thoại</span><strong>—</strong></div><div><span>Sản phẩm</span><strong>—</strong></div></div><div className={styles.readyCard}><span className={styles.readyIcon} aria-hidden="true">↗</span><strong>Sẵn sàng kết nối<br />kênh bán hàng</strong><p>Những cuộc trò chuyện mới<br />sẽ bắt đầu từ đây.</p><div className={styles.miniChannels} aria-hidden="true"><span>m</span><span>Z</span><span>♪</span><span>S</span></div></div></div></div>
      <div className={styles.ownerRow}><span className={styles.adminAvatar}>A</span><div><strong>Admin</strong><p>Chủ shop · Toàn quyền quản lý</p></div><span className={styles.ownerBadge}>CHỦ SHOP</span></div>
    </div>
    <div className={styles.appearance}><fieldset><legend>Biểu tượng đại diện</legend><div className={styles.avatarChoices}>{avatarOptions.map(option => <button type="button" key={option.value} aria-label={option.label} aria-pressed={avatar === option.value} onClick={() => setAvatar(option.value)}>{option.value === 'initial' ? Array.from(name.trim())[0]?.toUpperCase() || 'T' : option.symbol}</button>)}</div></fieldset><fieldset><legend>Màu nền</legend><div className={styles.toneChoices}>{toneOptions.map(option => <button type="button" className={styles[option.value]} key={option.value} aria-label={option.label} aria-pressed={avatarTone === option.value} onClick={() => setAvatarTone(option.value)}><span aria-hidden="true">{avatarTone === option.value ? '✓' : ''}</span></button>)}</div></fieldset></div>
    <p className={styles.previewCaption}>Thông tin thay đổi cùng những gì bạn nhập.</p>
  </aside></div></div>;
}

function Connections({ workspace, connections }: { workspace: MockWorkspace; connections: Partial<Record<MockPlatform, string>> }) {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<MockPlatform>('messenger');
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = platforms.find(item => item.id === selectedPlatform)!;
  const count = Object.keys(connections).length;
  const accounts = selectedPlatform === 'zalo' ? [`${workspace.name} · Zalo cá nhân mẫu`, `${workspace.name} · Zalo OA mẫu`] : [`${workspace.name} · ${selected.name} mẫu`, `Cửa hàng trải nghiệm · ${selected.name} mẫu`];

  function open(platform: MockPlatform) {
    const item = platforms.find(value => value.id === platform)!;
    setSelectedPlatform(platform);
    setAccount(platform === 'zalo' ? `${workspace.name} · Zalo cá nhân mẫu` : `${workspace.name} · ${item.name} mẫu`);
    setError('');
    dialog.current?.showModal();
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { connectMockPlatform(selectedPlatform, account); dialog.current?.close(); setAnnouncement(`Đã kết nối mô phỏng ${selected.name}.`); }
    catch { setError('Chưa lưu được kết nối. Vui lòng kiểm tra quyền lưu dữ liệu của trình duyệt.'); }
  }

  function disconnect(platform: MockPlatform) {
    try { connectMockPlatform(platform, null); setAnnouncement('Đã ngắt kết nối mẫu.'); }
    catch { setAnnouncement('Không lưu được thay đổi. Vui lòng thử lại.'); }
  }

  function finish() {
    try { completeMockOnboarding(); router.push('/tong-quan'); }
    catch { setAnnouncement('Không lưu được tiến độ. Vui lòng thử lại.'); }
  }

  function card(platform: typeof platforms[number]) {
    const connected = !!connections[platform.id];
    return <article className={`${styles.platformCard} ${styles[`${platform.id}Card`]} ${connected ? styles.connectedCard : ''}`} key={platform.id}>
      <div className={styles.platformTop}><PlatformMark id={platform.id} /><span className={connected ? styles.connectedBadge : styles.availableBadge}><i aria-hidden="true" />{connected ? 'Đã kết nối mẫu' : 'Chưa kết nối'}</span></div>
      <h3>{platform.name}</h3><p className={styles.platformDescription}>{platform.description}</p>
      {connected ? <><p className={styles.accountName} title={connections[platform.id]}>{connections[platform.id]}</p><button type="button" className={styles.disconnect} onClick={() => disconnect(platform.id)}>Ngắt kết nối</button></> : <button type="button" className={styles.connect} onClick={() => open(platform.id)}>Kết nối {platform.name} <span aria-hidden="true">+</span></button>}
    </article>;
  }

  return <div className={styles.connectionsPanel}>
    <p className={styles.eyebrow}>BƯỚC 02 / 03</p>
    <h1 id="onboarding-title">Khách ở đâu, bạn ở đó.</h1>
    <p className={styles.description}>Chọn các nền tảng cho <strong>{workspace.name}</strong>. Bạn có thể kết nối thêm bất cứ lúc nào.</p>
    <div className={styles.mockBanner}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" strokeLinecap="round" /></svg><p>Đang trải nghiệm bằng tài khoản mẫu. Chưa liên kết hay đồng bộ dữ liệu thật.</p></div>

    <section aria-labelledby="conversation-platforms-title">
      <div className={styles.groupHeading}><div><h2 id="conversation-platforms-title">Hội thoại khách hàng</h2><p>Nhận và trả lời tin nhắn từ các kênh của shop.</p></div><span className={styles.groupCount}>{platforms.filter(item => item.id !== 'shopee' && connections[item.id]).length} / 3 đã chọn</span></div>
      <div className={styles.platformGrid}>{platforms.filter(item => item.id !== 'shopee').map(card)}</div>
    </section>

    <section aria-labelledby="product-platforms-title">
      <div className={styles.groupHeading}><div><h2 id="product-platforms-title">Sản phẩm & bán hàng</h2><p>Đưa sản phẩm về làm nguồn tư vấn cho AI. Giá và tồn kho chưa đồng bộ thật trong bản mẫu.</p></div></div>
      <div className={styles.productGrid}>
        {card(platforms[3])}
        <article className={`${styles.platformCard} ${styles.comingSoonCard}`}><div className={styles.platformTop}><PlatformMark id="tiktok" /><span className={styles.soonBadge}>Sắp ra mắt</span></div><h3>TikTok Shop</h3><p className={styles.platformDescription}>Kết nối danh mục sản phẩm từ gian hàng TikTok.</p><button type="button" className={styles.soonButton} disabled>Chưa khả dụng</button></article>
        <article className={`${styles.platformCard} ${styles.comingSoonCard}`}><div className={styles.platformTop}><span className={`${styles.platformMark} ${styles.fileMark}`} aria-hidden="true"><svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8m-8 4h8m-4-4v7" /></svg></span><span className={styles.soonBadge}>Sắp ra mắt</span></div><h3>Website / Excel</h3><p className={styles.platformDescription}>Bổ sung sản phẩm từ website hoặc tệp dữ liệu của shop.</p><button type="button" className={styles.soonButton} disabled>Chưa khả dụng</button></article>
      </div>
    </section>

    <p className={styles.announcement} role="status" aria-live="polite">{announcement}</p>
    <div className={styles.actionBar}><div className={styles.actions}><Link className={styles.back} href="/tao-shop">← Quay lại</Link><div>{count === 0 && <button type="button" className={styles.skip} onClick={finish}>Bỏ qua bước này</button>}<button type="button" className={styles.primary} onClick={finish}>Vào trang tổng quan <span aria-hidden="true">→</span></button></div></div><p className={styles.connectionCount}>{count > 0 ? `${count} nền tảng đã kết nối mẫu · Bạn đã sẵn sàng để khám phá.` : 'Bạn có thể bỏ qua và kết nối thêm sau.'}</p></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="connect-title"><button type="button" className={styles.close} aria-label="Đóng" onClick={() => dialog.current?.close()}>×</button><PlatformMark id={selectedPlatform} /><h2 id="connect-title">Kết nối {selected.name}</h2><p>Chọn một tài khoản mẫu để trải nghiệm flow kết nối.</p><form onSubmit={connect}><fieldset><legend>Tài khoản có thể kết nối</legend>{accounts.map(value => <label key={value} className={styles.accountOption}><input type="radio" name="account" value={value} checked={account === value} onChange={() => setAccount(value)} required /><span>{value}</span></label>)}</fieldset><p className={styles.hint}>Thao tác mô phỏng, không yêu cầu mật khẩu hoặc quyền truy cập tài khoản thật.</p>{error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" className={styles.primary}>Xác nhận kết nối mẫu <Arrow /></button></form></dialog>
  </div>;
}
