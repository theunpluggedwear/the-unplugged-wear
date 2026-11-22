import React from 'react';

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}



export default function PanelHeader({ children, style = {}, ...props }: PanelHeaderProps) {
  return (
    <div style={{ flex: 'none', ...style }} {...props}>
      {children}
    </div>
  );
}
