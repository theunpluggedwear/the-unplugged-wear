import React from 'react';

export interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: string;
  gap?: string;
  
  direction?: 'row' | 'column';
  
  hoverable?: boolean;
  
  fullWidth?: boolean;
}





export default function SurfaceCard({
  children,
  padding = '20px 24px',
  gap,
  direction = 'column',
  hoverable = false,
  fullWidth = false,
  className = '',
  style = {},
  ...props
}: SurfaceCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
        borderRadius: 'var(--tuw-radius-card, 12px)',
        padding,
        ...(gap !== undefined ? { gap } : {}),
        boxShadow: 'var(--shadow-subtle, 0 1px 4px rgba(0, 0, 0, 0.02))',
        border: '1px solid var(--tuw-border-subtle, #E5E7EB)',
        display: 'flex',
        flexDirection: direction,
        ...(fullWidth ? { width: '100%' } : {}),
        boxSizing: 'border-box',
        transition:
          'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
        ...style,
      }}
      className={`${hoverable ? 'tuw-stat-hover' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
