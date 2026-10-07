// ============================================================
// DOMAIN TYPES — Dashboard / Tổng Quan
// ============================================================

export interface UrgentItem {
  id: string;
  initials: string;
  name: string;
  tag: string;
  msg: string;
  time: string;
  channel: string;
  suggestedReply: string;
}

export type DashboardTab = 'overview' | 'report';
