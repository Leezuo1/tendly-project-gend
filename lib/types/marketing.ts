// ============================================================
// DOMAIN TYPES — Marketing
// ============================================================

export type MarketingTab = 'queue' | 'segments' | 'performance' | 'composer';

export interface ApprovalItem {
  id: string;
  avatar: string;
  avatarStyle?: React.CSSProperties;
  name: string;
  channel: string;
  tag: string;
  tagType: 'loop' | 'rfm' | 'vip';
  context: string;
  draft: string;
  time: string;
}

export interface SegmentStat {
  id: string;
  label: string;
  value: number;
  sub: string;
}

export interface RFMSegment {
  name: string;
  count: number;
  percentage: number;
  color: string;
  dotClass: string;
}
