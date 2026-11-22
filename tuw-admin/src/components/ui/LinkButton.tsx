import React from 'react';
import Link from 'next/link';
import { getButtonStyle } from './Button';
import type { ButtonSize, ButtonVariant } from './Button';

export interface LinkButtonProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}





export default function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  style = {},
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={className}
      style={{ ...getButtonStyle(variant, size, fullWidth, false), ...style }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </Link>
  );
}
