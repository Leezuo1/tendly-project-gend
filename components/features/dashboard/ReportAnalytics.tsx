import type { DashboardData } from '@/lib/types/dashboardData';
export function ReportAnalytics({ data }: { data: DashboardData | null }) {
  const max = Math.max(1, ...(data?.weeklyChats.map((item) => item.count) || []));
  return <div className="tab-panel" id="tab-report">
    <div className="kpi-grid">
      {['Tỷ lệ phản hồi sau email', 'Thời gian phản hồi trung bình', 'Hội thoại cảm xúc âm đã xử lý', 'Tỷ lệ mở email'].map((label) =>
        <div className="kpi-card" key={label}><div className="label">{label}</div><div className="value" /></div>)}
    </div>
    <div className="card">
      <div className="card-head"><h2>Hội thoại theo ngày</h2><span className="hint">7 ngày gần nhất · Messenger</span></div>
      <div className="bar-chart">{data?.weeklyChats.map((item) => <div className="bar-col" key={item.day}>
        <span className="bar-val">{item.count}</span>
        <div className="bar" style={{ height: (item.count / max * 140) + 'px' }} title={item.day + ': ' + item.count + ' hội thoại'} />
        <span className="bar-day">{item.day.slice(5).split('-').reverse().join('/')}</span>
      </div>)}</div>
    </div>
    <div className="card"><div className="card-head"><h2>Sản phẩm được hỏi nhiều nhất</h2></div></div>
  </div>;
}
