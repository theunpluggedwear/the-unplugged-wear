import React from 'react';

export interface DrawerSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  
  title?: string;
  children: React.ReactNode;
  


  titleGap?: number;
}




export default function DrawerSection({
  title,
  children,
  titleGap = 10,
  style = {},
  ...props
}: DrawerSectionProps) {
  return (
    <div style={{ ...style }} {...props}>
      {title ? (
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--tuw-text-primary, #262626)',
            fontFamily: 'var(--font-main)',
            margin: `0 0 ${titleGap}px 0`,
          }}
        >
          {title}
        </h4>
      ) : null}
      {children}
    </div>
  );
}
