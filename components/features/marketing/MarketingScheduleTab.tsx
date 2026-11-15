'use client';

import { useEffect, useState } from 'react';
import { MARKETING_SCENARIOS, weeklyMarketingDates } from '@/lib/services/marketingBrief';
import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';

interface Props { view: MarketingWorkspaceView; act: (action: string, input: object) => Promise<boolean>; confirm: (title: string, message: string, action: () => Promise<unknown>) => void; }
const VN = 7 * 3600000, DAY = 86400000;
const localTime = (at: number) => new Date(at + VN).toISOString().slice(0, 16);
const hhmm = (at: number) => localTime(at).slice(11);
const dayKey = (at: number) => localTime(at).slice(0, 10);
/** Thứ Hai 00:00 (giờ Việt Nam) của tuần chứa `at`, tính theo ngày lịch Việt Nam. */
const mondayOf = (at: number) => { const d = new Date(at + VN); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (d.getUTCDay() + 6) % 7); };
const dm = (shifted: number) => new Date(shifted).toISOString().slice(8, 10) + '/' + new Date(shifted).toISOString().slice(5, 7);
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
// Giờ mặc định khi bấm vào ô trống của từng buổi.
const BANDS = [{ label: 'Sáng', hour: '09' }, { label: 'Trưa', hour: '12' }, { label: 'Tối', hour: '19' }];
const bandOf = (at: number) => { const hour = new Date(at + VN).getUTCHours(); return hour < 11 ? 0 : hour < 17 ? 1 : 2; };

export function MarketingScheduleTab({ view, act, confirm }: Props) {
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState(MARKETING_SCENARIOS[0]);
  const [start, setStart] = useState(() => localTime(Date.now() + 86400000));
  const [weeks, setWeeks] = useState(2);
  const [days, setDays] = useState([1, 3, 5]);
  const [postId, setPostId] = useState('');
  const [slots, setSlots] = useState<{ at: number; postId: string }[]>([]);
  const [error, setError] = useState('');
  const [week, setWeek] = useState(() => mondayOf(Date.now()));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const available = view.workspace.reviews.filter(review => review.approvedAt && review.publication !== 'unknown' && review.publication !== 'publishing' && view.workspace.campaigns.some(campaign => campaign.id === review.campaignId && campaign.version === review.campaignVersion && campaign.approvedAt));
  const label = (id: string) => { const post = view.posts.find(item => item.id === id); const meta = view.workspace.reviews.find(item => item.postId === id); const campaign = view.workspace.campaigns.find(item => item.id === meta?.campaignId); const account = view.accounts.find(item => item.id === meta?.accountId); return `${campaign?.name ?? ''} · ${post?.title ?? 'Bài không còn tồn tại'} · ${account?.platform}${account?.mock ? ' (mẫu)' : ''}`; };
  const channel = (id: string) => { const account = view.accounts.find(item => item.id === view.workspace.reviews.find(r => r.postId === id)?.accountId); return `${account?.platform ?? ''}${account?.mock ? ' (mẫu)' : ''}`; };
  const title = (id: string) => view.posts.find(item => item.id === id)?.title ?? 'Bài không còn tồn tại';
  const preview = () => {
    try {
      const id = postId || available[0]?.postId;
      if (!id) throw new Error('Duyệt ít nhất một bài trước khi lập lịch.');
      const first = Date.parse(`${start}:00+07:00`);
      const times = scenario === 'Hằng tuần' ? weeklyMarketingDates(start.slice(0, 10), days, start.slice(11), weeks) : scenario === 'Một lần' ? [first] : [first, first + 86400000, first + 2 * 86400000];
      if (times.some(at => !Number.isFinite(at) || at <= Date.now())) throw new Error('Chọn thời gian ở tương lai.');
      setSlots(times.map(at => ({ at, postId: id }))); setWeek(mondayOf(times[0])); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const addAt = (key: string, hour: string) => {
    const id = postId || available[0]?.postId;
    if (!id) { setError('Duyệt ít nhất một bài trước khi lập lịch.'); return; }
    setSlots(current => [...current, { at: Date.parse(`${key}T${hour}:00:00+07:00`), postId: id }].sort((a, b) => a.at - b.at)); setScenario('Tự sắp xếp'); setError('');
  };
  const reset = () => { setSlots([]); setName(''); setError(''); };
  const saved = view.workspace.schedules.filter(schedule => schedule.status !== 'cancelled').flatMap(schedule => schedule.slots.map(slot => ({ at: slot.at, postId: slot.postId, draft: false, key: slot.id })));
  const planned = [...saved, ...slots.map((slot, i) => ({ at: slot.at, postId: slot.postId, draft: true, key: `draft-${i}` }))];
  const columns = DAYS.map((day, i) => { const shifted = week + i * DAY; return { day, shifted, key: new Date(shifted).toISOString().slice(0, 10) }; });
  return <div className="mw-schedules"><div className="mw-section-head"><h2>Lịch đăng</h2>
    <div className="mw-week-nav" role="group" aria-label="Chọn tuần"><button type="button" className="btn btn-outline btn-sm" onClick={() => setWeek(week - 7 * DAY)}>Tuần trước</button><b aria-live="polite">{dm(week)} – {dm(week + 6 * DAY)}</b><button type="button" className="btn btn-outline btn-sm" onClick={() => setWeek(week + 7 * DAY)}>Tuần sau</button><button type="button" className="btn btn-text btn-sm" onClick={() => setWeek(mondayOf(now))}>Hôm nay</button></div></div>
    <label className="mw-week-post">Bài sẽ xếp khi bấm vào ô trống<select value={postId || available[0]?.postId || ''} onChange={event => setPostId(event.target.value)}>{!available.length && <option value="">Chưa có bài đã duyệt</option>}{available.map(review => <option key={review.postId} value={review.postId}>{label(review.postId)}</option>)}</select></label>
    {error && <p className="mw-error" role="alert">{error}</p>}
    <ol className="mw-week" aria-label="Lịch tuần, giờ Việt Nam">{columns.map(column => <li className="mw-day" key={column.key}><h3>{column.day}<span>{dm(column.shifted)}</span></h3>
      {BANDS.map((band, b) => { const items = planned.filter(item => dayKey(item.at) === column.key && bandOf(item.at) === b).sort((x, y) => x.at - y.at); const past = Date.parse(`${column.key}T${band.hour}:00:00+07:00`) <= now; return <div className="mw-band" key={band.label}><span className="mw-band-label">{band.label}</span>
        {items.map(item => <div className={`mw-slot-card${item.draft ? ' draft' : ''}`} key={item.key}><time>{hhmm(item.at)}{item.draft && ' · nháp'}</time><b>{title(item.postId)}</b><small>{channel(item.postId)}</small></div>)}
        {!past && <button type="button" className="mw-add-slot" disabled={!available.length} onClick={() => addAt(column.key, band.hour)}>{items.length ? '+ Thêm' : '+ Xếp bài vào giờ này'}</button>}</div>; })}</li>)}</ol>
    <form className="mw-editor" data-unsaved={!!name || !!slots.length} onSubmit={async event => { event.preventDefault(); if (await act('schedule', { name, scenario, slots })) { setSlots([]); setName(''); } }}>
      {!!slots.length && <><div className="mw-schedule-save"><label>Tên lịch<input required maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label></div>
        <div className="mw-slot-list">{slots.map((slot, i) => <div className="mw-slot" key={i}><label>Ngày giờ · mốc {i + 1}<input type="datetime-local" value={localTime(slot.at)} onChange={event => { const at = Date.parse(`${event.target.value}:00+07:00`); if (Number.isFinite(at)) setSlots(current => current.map((item, j) => j === i ? { ...item, at } : item)); }} /></label><label>Campaign / bài / kênh<select value={slot.postId} onChange={event => setSlots(current => current.map((item, j) => j === i ? { ...item, postId: event.target.value } : item))}>{available.map(review => <option key={review.postId} value={review.postId}>{label(review.postId)}</option>)}</select></label><button type="button" className="btn btn-text btn-sm" onClick={() => setSlots(current => current.filter((_, j) => i !== j))}>Bỏ mốc</button></div>)}</div>
        <p className="mw-hint">{slots.length} lần đăng. Nếu dùng lại cùng bài ở nhiều mốc, việc duyệt lịch sẽ xác nhận từng lần lặp đó.</p>
        <div className="mw-actions"><button type="button" className="btn btn-outline" onClick={reset}>Hủy bản lịch đang soạn</button><button className="btn btn-primary" type="submit">Lưu lịch nháp</button></div></>}
      <details className="mw-fold"><summary>Tạo nhanh nhiều mốc theo kịch bản</summary>
        <div className="mw-form-grid"><label>Kịch bản<select value={scenario} onChange={event => { setScenario(event.target.value); setSlots([]); }}>{MARKETING_SCENARIOS.map(item => <option key={item}>{item}</option>)}</select></label><label>Mốc đầu tiên<input type="datetime-local" required value={start} onChange={event => { setStart(event.target.value); setSlots([]); }} /></label></div>
        {scenario === 'Hằng tuần' && <div className="mw-weekdays"><label>Số tuần (1–12)<input type="number" min={1} max={12} value={weeks} onChange={event => { setWeeks(Number(event.target.value)); setSlots([]); }} /></label>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => <label className="mw-check" key={day}><input type="checkbox" checked={days.includes(index)} onChange={event => { setDays(event.target.checked ? [...days, index] : days.filter(item => item !== index)); setSlots([]); }} />{day}</label>)}</div>}
        {scenario !== 'Một lần' && scenario !== 'Hằng tuần' && <p className="mw-hint">Mẫu bắt đầu với 3 mốc. Chỉnh thời gian và chọn bài đúng giai đoạn trước khi lưu.</p>}
        <button type="button" className="btn btn-outline btn-sm" onClick={preview}>Tạo các mốc để xem trước</button></details>
    </form>
    <div className="mw-list">{view.workspace.schedules.map(schedule => <article className="mw-item" key={schedule.id}><div className="mw-section-head"><div><h3>{schedule.name}</h3><p>{schedule.scenario} · {schedule.slots.length} mốc</p></div><span className={`mw-badge ${schedule.status === 'active' || schedule.status === 'approved' ? 'approved' : schedule.status === 'cancelled' ? 'stale' : schedule.status === 'paused' ? 'waiting' : 'draft'}`}>{({ draft: 'Nháp', approved: 'Đã duyệt', active: 'Đang hoạt động', paused: 'Tạm dừng', cancelled: 'Đã hủy' })[schedule.status]}</span></div><div className="mw-slot-list">{schedule.slots.map(slot => <div className="mw-saved-slot" key={slot.id}><time>{new Date(slot.at).toLocaleString('vi-VN', { timeZone: schedule.timezone })}</time><span>{label(slot.postId)}</span><small>{({ scheduled: 'Đã xếp lịch', publishing: 'Đang đăng', published: 'Đã hoàn tất', blocked: 'Cần kiểm tra', unknown: 'Chờ xác minh', missed: 'Đã lỡ mốc' })[slot.status]}{slot.message && ` · ${slot.message}`}</small></div>)}</div>
      <div className="mw-actions">{schedule.status !== 'cancelled' && <><button className="btn btn-text btn-sm" onClick={() => confirm('Hủy lịch?', 'Hủy các mốc chưa gửi. Bài đã đăng và yêu cầu đang gửi không được xóa trên nền tảng.', () => act('cancelSchedule', { id: schedule.id }))}>Hủy lịch</button>{schedule.status === 'active' && <button className="btn btn-outline btn-sm" onClick={() => act('pauseSchedule', { id: schedule.id })}>Tạm dừng</button>}{!schedule.approvedAt && <button className="btn btn-primary btn-sm" onClick={() => confirm('Duyệt lịch đăng?', `Xác nhận ${schedule.slots.length} mốc với đúng bài, kênh và giờ đang hiển thị.`, () => act('approveSchedule', { id: schedule.id }))}>Duyệt lịch</button>}{schedule.approvedAt && schedule.status !== 'active' && <button className="btn btn-primary btn-sm" onClick={() => confirm('Kích hoạt lịch?', 'Các mốc Facebook sẽ được đăng thật khi đến hạn. Các kênh mẫu chỉ hoàn tất trong flow mẫu.', () => act('activateSchedule', { id: schedule.id }))}>Kích hoạt</button>}</>}</div></article>)}</div>
  </div>;
}
