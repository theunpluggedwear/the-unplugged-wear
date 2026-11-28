import React from 'react';

export interface PageHeaderProps {
  title: string;
  
  subtitle?: React.ReactNode;
  
  actions?: React.ReactNode;
  
  eyebrow?: React.ReactNode;
  




  variant?: 'page' | 'doc';
}




export default function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  variant = 'page',
}: PageHeaderProps) {
  const isDoc = variant === 'doc';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {eyebrow ? <div style={{ marginBottom: 8 }}>{eyebrow}</div> : null}
        {isDoc ? (
          <h1 className="tuw-type-heading-page" style={{ color: 'var(--tuw-text-primary, #262626)', margin: 0 }}>
            {title}
          </h1>
        ) : (
          <h2
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--tuw-text-primary, #262626)',
              fontFamily: 'var(--font-main)',
              margin: 0,
            }}
          >
            {title}
          </h2>
        )}
        {subtitle ? (
          <p style={{ fontSize: 14, color: 'var(--tuw-text-secondary, #5D6772)', fontFamily: 'var(--font-main)', margin: 0 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{actions}</div>
      ) : null}
    </div>
  );
}
