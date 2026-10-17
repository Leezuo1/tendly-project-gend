'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginMock } from '@/lib/services/mockOnboarding';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import styles from './auth.module.css';

type Mode = 'login' | 'register';
type FieldName = 'name' | 'email' | 'password' | 'confirmPassword';
type Errors = Partial<Record<FieldName, string>>;

function Arrow({ back = false }: { back?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={back ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Sparkle() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

function Eye({ visible }: { visible: boolean }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />{visible && <path d="m4 3 16 18" stroke="currentColor" strokeWidth="1.5" />}</svg>;
}

function FeatureIcon({ kind }: { kind: 'care' | 'sales' | 'shop' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'care' ? <><path d="M5 17 3 21l5-2a9 9 0 1 0-3-2Z" /><path d="M8 10h8m-8 4h5" /></> : kind === 'sales' ? <><path d="m3 5 2 1 2 11h11l3-9H6M10 3v5m-2-2 2 2 2-2" /><circle cx="9" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></> : <><path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0" /><path d="M9 21v-6h6v6" /></>}
  </svg>;
}

function BrandStory() {
  return <aside className={styles.story} aria-label="Cùng Tendly chăm sóc khách hàng">
    <Link href="/" className={styles.logo} aria-label="Tendly — về trang chủ"><img src="/tendly-logo.png" alt="Tendly" width="144" height="48" /></Link>
    <div className={styles.storyBody}>
      <p className={styles.eyebrow}><span /> MỖI CUỘC TRÒ CHUYỆN ĐỀU QUAN TRỌNG</p>
      <h2 lang="en">Your AI teammate<br /> for every <em>customer.</em></h2>
      <p className={styles.storyDescription}>Hiểu sản phẩm. Gợi ý đúng lúc.<br /> Cùng bạn chăm sóc khách và phát triển shop.</p>

      <div className={styles.scene} role="img" aria-label="Minh họa hội thoại: khách hỏi về áo linen, Tendly gợi ý phản hồi để shop xem lại trước khi gửi.">
        <div className={styles.orbit} />
        <div className={styles.orbitInner} />
        <div className={styles.channelNote}><span className={styles.channelIcon}>m</span><span>Một tin nhắn mới<span className={styles.noteLine} /></span><span className={styles.notificationDot} /></div>
        <div className={styles.inboxCard}>
          <div className={styles.inboxHeader}><span className={styles.inboxTitle}>Cuộc trò chuyện nhỏ</span><span className={styles.sampleTag}>MINH HỌA</span></div>
          <div className={styles.customer}><span className={styles.avatar}>L</span><div><strong>Linh Nguyễn</strong><span>Khách hàng của bạn</span></div><span className={styles.customerTime}>Vừa xong</span></div>
          <div className={styles.bubble}>Shop ơi, áo linen này có màu kem không ạ?</div>
          <div className={styles.aiReply}><div className={styles.aiLabel}><Sparkle /> TENDLY GỢI Ý</div><p>Dạ có ạ! Áo linen có màu kem. Bạn muốn shop tư vấn thêm về size không ạ?</p><div className={styles.replyFoot}><span>Dựa trên sản phẩm của shop</span><span className={styles.review}>Xem lại & gửi <Arrow /></span></div></div>
        </div>
        <div className={styles.floatingNote}><span className={styles.checkmark}>✓</span> Bạn hiểu khách. Tendly phụ bạn.</div>
        <span className={styles.sceneStar} aria-hidden="true">✳</span>
      </div>

      <div className={styles.benefits}><div><FeatureIcon kind="care" /><p>Hỗ trợ chăm sóc khách hàng</p></div><div><FeatureIcon kind="sales" /><p>Hỗ trợ bán hàng</p></div><div><FeatureIcon kind="shop" /><p>Quản lý shop</p></div></div>
    </div>
    <div className={styles.storyFooter}><span>Ít việc lặp lại. Nhiều thời gian cho khách.</span><span className={styles.footerFlower} aria-hidden="true">✳</span></div>
  </aside>;
}

function Field({ name, label, error, hint, children }: { name: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className={styles.field}><label htmlFor={name}>{label}</label>{children}{error ? <p className={styles.fieldError} id={`${name}-hint`}>{error}</p> : hint ? <p className={styles.fieldHint} id={`${name}-hint`}>{hint}</p> : null}</div>;
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const register = mode === 'register';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState('');
  const [socialNotice, setSocialNotice] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [demoFilled, setDemoFilled] = useState(false);
  const authForm = useRef<HTMLFormElement>(null);
  const recoveryDialog = useRef<HTMLDialogElement>(null);

  function fillDemo() {
    const form = authForm.current;
    if (!form) return;
    const username = form.elements.namedItem('email') as HTMLInputElement;
    const password = form.elements.namedItem('password') as HTMLInputElement;
    username.value = 'admin';
    password.value = 'admin123';
    setShowPassword(false);
    setErrors({});
    setNotice('');
    setDemoFilled(true);
    form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    const password = String(values.get('password') || '');
    const next: Errors = {};
    if (register && !String(values.get('name') || '').trim()) next.name = 'Bạn nhập tên để Tendly tiện xưng hô nhé.';
    if (register && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) next.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
    if (!register && !email) next.email = 'Vui lòng nhập tài khoản hoặc email.';
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    else if (register && password.length < 8) next.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    if (register && String(values.get('confirmPassword') || '') !== password) next.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
    setErrors(next);
    setNotice('');
    const first = Object.keys(next)[0];
    if (first) { form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus(); return; }
    if (register) { setNotice('Đăng ký tài khoản hiện chưa khả dụng. Bạn có thể đăng nhập bằng tài khoản mẫu admin / admin123.'); return; }
    try {
      if (!loginMock(email, password)) { setNotice('Tài khoản hoặc mật khẩu chưa đúng. Tài khoản mẫu: admin / admin123.'); return; }
      router.push('/tao-shop');
    } catch { setNotice('Không lưu được phiên dùng thử. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.'); }
  }

  const inputProps = (name: FieldName) => ({
    id: name, name, 'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] || (name === 'password' && register) ? `${name}-hint` : undefined,
    onChange: () => { setErrors(previous => ({ ...previous, [name]: undefined })); setNotice(''); setDemoFilled(false); },
  });

  return <main className={styles.root}>
    <BrandStory />
    <section className={styles.formPanel} aria-labelledby="auth-title">
      <header className={styles.panelHeader}><Link href="/" className={styles.backLink}><Arrow back /> Về trang chủ</Link><span className={styles.language} aria-label="Ngôn ngữ hiện tại: Tiếng Việt">Tiếng Việt</span></header>
      <div className={styles.formBody} key={mode}>
        <div className={styles.intro}><span className={styles.welcomeMark} aria-hidden="true"><Sparkle /></span><p className={styles.formEyebrow}>KHÔNG GIAN CỦA BẠN, CÙNG TENDLY</p></div>
        <h1 id="auth-title">{register ? 'Bắt đầu cùng nhau.' : 'Mừng bạn trở lại.'}</h1>
        <p className={styles.formDescription}>{register ? 'Tạo tài khoản để bắt đầu hành trình chăm sóc khách hàng.' : 'Đăng nhập để tiếp tục những cuộc trò chuyện đang chờ bạn.'}</p>
        <nav className={styles.tabs} aria-label="Tài khoản Tendly"><Link href="/dang-nhap" aria-current={!register ? 'page' : undefined}>Đăng nhập</Link><Link href="/dang-ky" aria-current={register ? 'page' : undefined}>Tạo tài khoản</Link></nav>

        <form ref={authForm} onSubmit={submit} noValidate className={styles.form}>
          {register && <Field name="name" label="Tên của bạn" error={errors.name}><input {...inputProps('name')} type="text" placeholder="Ví dụ: Minh Anh" autoComplete="name" maxLength={100} required /></Field>}
          <Field name="email" label={register ? 'Email' : 'Tài khoản hoặc email'} error={errors.email}><input {...inputProps('email')} type={register ? 'email' : 'text'} placeholder={register ? 'ban@cuahang.com' : 'Nhập tài khoản hoặc email'} autoComplete={register ? 'email' : 'username'} autoCapitalize="none" spellCheck={false} maxLength={254} required /></Field>
          <Field name="password" label="Mật khẩu" error={errors.password} hint={register ? 'Sử dụng ít nhất 8 ký tự cho mật khẩu của bạn.' : undefined}><div className={styles.passwordInput}><input {...inputProps('password')} type={showPassword ? 'text' : 'password'} placeholder={register ? 'Tạo mật khẩu của bạn' : 'Nhập mật khẩu của bạn'} autoComplete={register ? 'new-password' : 'current-password'} required /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Eye visible={showPassword} /></button></div></Field>
          {register && <Field name="confirmPassword" label="Nhập lại mật khẩu" error={errors.confirmPassword}><div className={styles.passwordInput}><input {...inputProps('confirmPassword')} type={showConfirm ? 'text' : 'password'} placeholder="Nhập lại mật khẩu vừa tạo" autoComplete="new-password" required /><button type="button" aria-label={showConfirm ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} aria-pressed={showConfirm} onClick={() => setShowConfirm(!showConfirm)}><Eye visible={showConfirm} /></button></div></Field>}
          {!register && <div className={styles.formOptions}><button type="button" onClick={() => { setRecoveryNotice(''); recoveryDialog.current?.showModal(); }}>Quên mật khẩu?</button></div>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          <button type="submit" className={styles.submit}>{register ? 'Tạo tài khoản' : 'Đăng nhập'}<Arrow /></button>
        </form>
        {!register && <button type="button" className={styles.demoButton} onClick={fillDemo}><Sparkle /> Dùng tài khoản demo <span aria-hidden="true">↗</span></button>}
        <span className={styles.srOnly} role="status">{demoFilled ? 'Đã điền tài khoản demo. Bấm Đăng nhập để tiếp tục.' : ''}</span>

        <div className={styles.socialDivider}><span />Hoặc tiếp tục với<span /></div>
        <div className={styles.socialButtons} aria-label="Đăng nhập bằng tài khoản khác">
          <button type="button" onClick={() => setSocialNotice('Đây là bản xem trước. Đăng nhập bằng Google chưa khả dụng.')}>
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.04a10 10 0 0 0 0 9.02l3.35-2.59Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.35 2.59C7.18 7.71 9.4 5.95 12 5.95Z" /></svg>
            Google
          </button>
          <button type="button" onClick={() => setSocialNotice('Đây là bản xem trước. Đăng nhập bằng Facebook chưa khả dụng.')}>
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1877F2" /><path fill="#fff" d="M13.6 23v-8.5h2.85l.43-3.3H13.6V9.1c0-.95.27-1.6 1.65-1.6H17V4.55a22 22 0 0 0-2.55-.14c-2.52 0-4.25 1.53-4.25 4.35v2.43H7.35v3.3h2.85V23h3.4Z" /></svg>
            Facebook
          </button>
        </div>
        {socialNotice && <p className={styles.socialNotice} role="status">{socialNotice}</p>}

        <p className={styles.switchPrompt}>{register ? 'Bạn đã có tài khoản?' : 'Lần đầu đến với Tendly?'} <Link href={register ? '/dang-nhap' : '/dang-ky'}>{register ? 'Đăng nhập' : 'Tạo tài khoản'} <span aria-hidden="true">↗</span></Link></p>
      </div>
      <footer className={styles.panelFooter}><span>© {new Date().getFullYear()} Tendly</span><span>Đồng hành cùng shop Việt <span className={styles.smallFlower} aria-hidden="true">✳</span></span></footer>
    </section>

    <dialog ref={recoveryDialog} className={styles.dialog} aria-labelledby="recovery-title" onClick={event => { if (event.target === event.currentTarget) recoveryDialog.current?.close(); }}>
      <button type="button" className={styles.closeDialog} aria-label="Đóng" onClick={() => recoveryDialog.current?.close()}>×</button>
      <div className={styles.welcomeMark}><Sparkle /></div><h2 id="recovery-title">Quên mật khẩu?</h2><p>Nhập email bạn đã dùng để đăng ký Tendly.</p>
      <form onSubmit={event => { event.preventDefault(); setRecoveryNotice('Khôi phục mật khẩu hiện chưa khả dụng. Bạn vui lòng quay lại sau nhé.'); }}>
        <Field name="recovery-email" label="Email"><input id="recovery-email" name="email" type="email" autoComplete="email" placeholder="ban@cuahang.com" required /></Field>
        {recoveryNotice && <p className={styles.notice} role="status">{recoveryNotice}</p>}
        <button type="submit" className={styles.submit}>Gửi liên kết khôi phục <Arrow /></button>
      </form>
    </dialog>
  </main>;
}
