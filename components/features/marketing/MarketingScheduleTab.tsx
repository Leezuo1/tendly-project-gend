'use client';

import { useState } from 'react';
import { MARKETING_SCENARIOS, weeklyMarketingDates } from '@/lib/services/marketingBrief';
import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';

interface Props { view: MarketingWorkspaceView; act: (action: string, input: object) => Promise<boolean>; confirm: (title: string, message: string, action: () => Promise<unknown>) => void; }
const localTime = (at: number) => new Date(at + 7 * 3600000).toISOString().slice(0, 16);
export function MarketingScheduleTab({ view, act, confirm }: Props) {
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState(MARKETING_SCENARIOS[0]);
  const [start, setStart] = useState(() => localTime(Date.now() + 86400000));
  const [weeks, setWeeks] = useState(2);
  const [days, setDays] = useState([1, 3, 5]);
  const [postId, setPostId] = useState('');
  const [slots, setSlots] = useState<{ at: number; postId: string }[]>([]);
  const [error, setError] = useState('');
  const available = view.workspace.reviews.filter(review => review.approvedAt && review.publication !== 'unknown' && review.publication !== 'publishing' && view.workspace.campaigns.some(campaign => campaign.id === review.campaignId && campaign.version === review.campaignVersion && campaign.approvedAt));
  const label = (id: string) => { const post = view.posts.find(item => item.id === id); const meta = view.workspace.reviews.find(item => item.postId === id); const campaign = view.workspace.campaigns.find(item => item.id === meta?.campaignId); const account = view.accounts.find(item => item.id === meta?.accountId); return `${campaign?.name ?? ''} · ${post?.title ?? 'Bài không còn tồn tại'} · ${account?.platform}${account?.mock ? ' (mẫu)' : ''}`; };
  const preview = () => {
    try {
      const id = postId || available[0]?.postId;
      if (!id) throw new Error('Duyệt ít nhất một bài trước khi lập lịch.');
      const first = Date.parse(`${start}:00+07:00`);
      const times = scenario === 'Hằng tuần' ? weeklyMarketingDates(start.slice(0, 10), days, start.slice(11), weeks) : scenario === 'Một lần' ? [first] : [first, first + 86400000, first + 2 * 86400000];
      if (times.some(at => !Number.isFinite(at) || at <= Date.now())) throw new Error('Chọn thời gian ở tương lai.');
      setSlots(times.map(at => ({ at, postId: id }))); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  return <div className="mw-schedules"><div className="mw-section-head"><div><h2>Lịch đăng</h2><p>Giờ Việt Nam · chọn bài đã duyệt, xem từng mốc rồi duyệt và kích hoạt.</p></div></div>
    <form className="mw-editor" data-unsaved={!!name || !!slots.length} onSubmit={async event => { event.preventDefault(); if (await act('schedule', { name, scenario, slots })) { setSlots([]); setName(''); } }}>
      <div className="mw-form-grid"><label>Tên lịch<input required maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label><label>Kịch bản<select value={scenario} onChange={event => { setScenario(event.target.value); setSlots([]); }}>{MARKETING_SCENARIOS.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Mốc đầu tiên<input type="datetime-local" required value={start} onChange={event => { setStart(event.target.value); setSlots([]); }} /></label><label>Bài dùng để bắt đầu xếp lịch<select value={postId || available[0]?.postId || ''} onChange={event => setPostId(event.target.value)}>{!available.length && <option value="">Chưa có bài đã duyệt</option>}{available.map(review => <option key={review.postId} value={review.postId}>{label(review.postId)}</option>)}</select></label></div>
      {scenario === 'Hằng tuần' && <div className="mw-weekdays"><label>Số tuần (1–12)<input type="number" min={1} max={12} value={weeks} onChange={event => { setWeeks(Number(event.target.value)); setSlots([]); }} /></label>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => <label className="mw-check" key={day}><input type="checkbox" checked={days.includes(index)} onChange={event => { setDays(event.target.checked ? [...days, index] : days.filter(item => item !== index)); setSlots([]); }} />{day}</label>)}</div>}
      <button type="button" className="btn btn-outline" onClick={preview}>Tạo các mốc để xem trước</button>
      {(name || slots.length > 0) && <button type="button" className="btn btn-text" onClick={() => { setSlots([]); setName(''); setError(''); }}>Hủy bản lịch đang soạn</button>}
      {scenario !== 'Một lần' && scenario !== 'Hằng tuần' && <p className="mw-muted">Mẫu bắt đầu với 3 mốc. Chỉnh thời gian và chọn bài đúng giai đoạn trước khi lưu.</p>}
      {error && <p className="mw-error" role="alert">{error}</p>}
      {!!slots.length && <><p className="mw-muted">{slots.length} lần đăng. Nếu dùng lại cùng bài ở nhiều mốc, việc duyệt lịch sẽ xác nhận từng lần lặp đó.</p><div className="mw-slot-list">{slots.map((slot, i) => <div className="mw-slot" key={i}><label>Ngày giờ · mốc {i + 1}<input type="datetime-local" value={localTime(slot.at)} onChange={event => { const at = Date.parse(`${event.target.value}:00+07:00`); if (Number.isFinite(at)) setSlots(current => current.map((item, j) => j === i ? { ...item, at } : item)); }} /></label><label>Campaign / bài / kênh<select value={slot.postId} onChange={event => setSlots(current => current.map((item, j) => j === i ? { ...item, postId: event.target.value } : item))}>{available.map(review => <option key={review.postId} value={review.postId}>{label(review.postId)}</option>)}</select></label><button type="button" className="btn btn-text btn-sm" onClick={() => setSlots(current => current.filter((_, j) => i !== j))}>Bỏ mốc</button></div>)}</div><button className="btn btn-primary" type="submit">Lưu lịch nháp</button></>}
    </form>
    <div className="mw-list">{view.workspace.schedules.map(schedule => <article className="mw-item" key={schedule.id}><div className="mw-section-head"><div><h3>{schedule.name}</h3><p>{schedule.scenario} · {({ draft: 'Nháp', approved: 'Đã duyệt', active: 'Đang hoạt động', paused: 'Tạm dừng', cancelled: 'Đã hủy' })[schedule.status]}</p></div><span className="mw-chip">{schedule.slots.length} mốc</span></div><div className="mw-slot-list">{schedule.slots.map(slot => <div className="mw-saved-slot" key={slot.id}><time>{new Date(slot.at).toLocaleString('vi-VN', { timeZone: schedule.timezone })}</time><span>{label(slot.postId)}</span><small>{({ scheduled: 'Đã xếp lịch', publishing: 'Đang đăng', published: 'Đã hoàn tất', blocked: 'Cần kiểm tra', unknown: 'Chờ xác minh', missed: 'Đã lỡ mốc' })[slot.status]}{slot.message && ` · ${slot.message}`}</small></div>)}</div>
      <div className="mw-actions">{schedule.status !== 'cancelled' && <>{!schedule.approvedAt && <button className="btn btn-outline btn-sm" onClick={() => confirm('Duyệt lịch đăng?', `Xác nhận ${schedule.slots.length} mốc với đúng bài, kênh và giờ đang hiển thị.`, () => act('approveSchedule', { id: schedule.id }))}>Duyệt lịch</button>}{schedule.approvedAt && schedule.status !== 'active' && <button className="btn btn-primary btn-sm" onClick={() => confirm('Kích hoạt lịch?', 'Các mốc Facebook sẽ được đăng thật khi đến hạn. Các kênh mẫu chỉ hoàn tất trong flow mẫu.', () => act('activateSchedule', { id: schedule.id }))}>Kích hoạt</button>}{schedule.status === 'active' && <button className="btn btn-outline btn-sm" onClick={() => act('pauseSchedule', { id: schedule.id })}>Tạm dừng</button>}<button className="btn btn-text btn-sm" onClick={() => confirm('Hủy lịch?', 'Hủy các mốc chưa gửi. Bài đã đăng và yêu cầu đang gửi không được xóa trên nền tảng.', () => act('cancelSchedule', { id: schedule.id }))}>Hủy lịch</button></>}</div></article>)}</div>
  </div>;
}
