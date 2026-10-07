// ============================================================
// DOMAIN TYPES — Landing Page
// ============================================================

export interface Brand {
  letter: string;
  name: string;
  bg: string;
}

export interface Stat {
  num: string;
  label: string;
  target: number;
}

export interface Step {
  num: string;
  title: string;
  body: string;
}

export interface FeatureCard {
  icon: string;
  iconBg: string;
  title: string;
  body: string;
}

export interface BentoItem {
  icon: string;
  iconBg: string;
  iconColor?: string;
  tag?: string;
  tagBg?: string;
  tagColor?: string;
  title: string;
  body: string;
  span?: number;
}

export interface ConversationRow {
  initials: string;
  bg: string;
  color: string;
  name: string;
  tag: string;
  tagClass: 'tag-high' | 'tag-return' | 'tag-new';
  msg: string;
  dotColor: string;
  channel: string;
}
