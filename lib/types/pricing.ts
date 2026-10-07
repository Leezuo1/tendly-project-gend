// ============================================================
// DOMAIN TYPES — Pricing
// ============================================================

export type CtaVariant = 'primary' | 'ghost' | 'ghost-box';

export interface PricingPlan {
  eyebrow: string;
  eyebrowStyle: React.CSSProperties;
  title: string;
  desc: string;
  price?: string;
  priceCustom?: string;
  period?: string;
  cta: string;
  ctaVariant: CtaVariant;
  features: string[];
  audience: string;
  isPopular: boolean;
}
