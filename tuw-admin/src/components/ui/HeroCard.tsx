import React from 'react';

export interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  

  label?: React.ReactNode;
  

  children: React.ReactNode;
  
  badge?: React.ReactNode;
  
  pad?: number;
}






export default function HeroCard({ label, children, badge, pad = 16, style = {}, ...props }: HeroCardProps) {
  return (
    <div
      style={{
        padding: pad,
        backgroundColor: 'var(--tuw-bg-canvas, #F7F8F9)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        ...style,
      }}
      {...props}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {label ? (
          <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>{label}</span>
        ) : null}
        {children}
      </div>
      {badge ? <div style={{ flexShrink: 0 }}>{badge}</div> : null}
    </div>
  );
}
