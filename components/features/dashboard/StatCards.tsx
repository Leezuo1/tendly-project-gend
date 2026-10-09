import type { DashboardData } from '@/lib/types/dashboardData';
export function StatCards({ data }: { data: DashboardData | null }) {
  const cards = [
    { label: 'Hội thoại đang chờ', value: data?.waiting },
    { label: 'Tin khách gửi hôm nay', value: data?.incomingToday },
    { label: 'Tin shop gửi hôm nay', value: data?.outgoingToday },
    { label: 'Email tự động hôm nay', value: undefined },
  ];
  return <div className="stat-grid">{cards.map((card) => <div className="stat-card" key={card.label}>
    <div className="label">{card.label}</div><div className="value">{card.value ?? ''}</div>
  </div>)}</div>;
}
