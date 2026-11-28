import React from 'react';

export interface ItemsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  
  title?: string;
  
  meta?: string;
  

  left?: React.ReactNode;
  
  right?: React.ReactNode;
  
  pad?: number;
}



export default function ItemsRow({ title, meta, left, right, pad = 12, style = {}, ...props }: ItemsRowProps) {
  return (
    <div
      style={{
        padding: pad,
        backgroundColor: 'var(--tuw-bg-canvas, #F7F8F9)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        ...style,
      }}
      {...props}
    >
      {left ? (
        left
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
          {title}
        </span>
        {meta ? (
          <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>{meta}</span>
        ) : null}
      </div>
      )}
      {right ? <div style={{ flexShrink: 0, textAlign: 'right' }}>{right}</div> : null}
    </div>
  );
}
