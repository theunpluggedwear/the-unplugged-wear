import React from 'react';

export interface UpliftSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  
  active?: boolean;
  
  width?: number | string;
  height?: number | string;
  
  radius?: number | string;
}





export default function UpliftSurface({
  active = false,
  width = 'auto',
  height = 'auto',
  radius = 'var(--tuw-radius-control, 8px)',
  style = {},
  className = '',
  children,
  ...props
}: UpliftSurfaceProps) {
  return (
    <div
      className={`${active ? 'tuw-3d-active' : ''} ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: radius,
        display: 'inline-flex',
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
