import React from 'react';

export type BadgeVariant = 'high' | 'return' | 'new' | 'neutral' | 'custom';

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({
  variant = 'neutral',
  className = '',
  children,
  style,
}: BadgeProps) {
  let variantClass = 'tag-neutral';
  if (variant === 'high') variantClass = 'tag-high';
  if (variant === 'return') variantClass = 'tag-return';
  if (variant === 'new') variantClass = 'tag-new';

  return (
    <span className={`tag ${variantClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
