import React from 'react';

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
}

export interface KeyValueListProps extends React.HTMLAttributes<HTMLDivElement> {
  items: KeyValueItem[];
  
  gap?: number;
  
  divided?: boolean;
  

  after?: React.ReactNode;
}




export default function KeyValueList({
  items,
  gap = 10,
  divided = false,
  after,
  style = {},
  ...props
}: KeyValueListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }} {...props}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 13,
            ...(divided
              ? {
                  borderBottom: '1px solid var(--tuw-border-subtle, #E2E4E6)',
                  paddingBottom: 8,
                }
              : null),
          }}
        >
          <span style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>{item.label}</span>
          <span
            style={{
              fontWeight: 500,
              color: 'var(--tuw-text-primary, #262626)',
              textAlign: 'right',
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
      {after ? after : null}
    </div>
  );
}
