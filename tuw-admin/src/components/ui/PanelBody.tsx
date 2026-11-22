import React from 'react';

export interface PanelBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  
  scrollable?: boolean;
}



export default function PanelBody({ children, scrollable = true, style = {}, ...props }: PanelBodyProps) {
  return (
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: scrollable ? 'auto' : 'visible',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
