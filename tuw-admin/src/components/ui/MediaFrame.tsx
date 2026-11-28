import React from 'react';

export interface MediaFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  
  children: React.ReactNode;
  
  height: number | string;
  
  width?: number | string;
  
  radius?: number | string;
}





export default function MediaFrame({
  children,
  height,
  width = '100%',
  radius = 10,
  style = {},
  ...props
}: MediaFrameProps) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        border: '1px solid var(--tuw-border-subtle, #E5E7EB)',
        backgroundColor: 'var(--tuw-bg-canvas, #F7F8F9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
