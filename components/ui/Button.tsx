import React from 'react';
import Link from 'next/link';

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'ghost-box';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

interface AnchorButtonProps extends BaseButtonProps, React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

interface NativeButtonProps extends BaseButtonProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: undefined;
}

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = `btn btn-${variant} btn-${size} ${className}`.trim();

  if ('href' in props && props.href) {
    const { href, ...anchorProps } = props as AnchorButtonProps;
    const isInternal = href.startsWith('/') || href.startsWith('#');
    
    if (isInternal && !href.startsWith('#')) {
      return (
        <Link href={href} className={baseClasses} {...anchorProps}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={baseClasses} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = props as NativeButtonProps;
  return (
    <button type={buttonProps.type || 'button'} className={baseClasses} {...buttonProps}>
      {children}
    </button>
  );
}
