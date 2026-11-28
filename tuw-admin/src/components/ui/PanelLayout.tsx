import React from 'react';
import PanelHeader from './PanelHeader';
import PanelBody from './PanelBody';
import PanelFooter from './PanelFooter';

export interface PanelLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  
  header?: React.ReactNode;
  
  footer?: React.ReactNode;
  
  children: React.ReactNode;
  
  scrollable?: boolean;
}






export default function PanelLayout({
  header,
  footer,
  children,
  scrollable = true,
  style = {},
  ...props
}: PanelLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        ...style,
      }}
      {...props}
    >
      {header ? <PanelHeader>{header}</PanelHeader> : null}
      <PanelBody scrollable={scrollable}>{children}</PanelBody>
      {footer ? <PanelFooter>{footer}</PanelFooter> : null}
    </div>
  );
}
