import React from 'react';

export interface PanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}




export default function PanelFooter({ children, style = {}, ...props }: PanelFooterProps) {
  return (
    <div style={{ flex: 'none', marginTop: 'auto', ...style }} {...props}>
      {children}
    </div>
  );
}
