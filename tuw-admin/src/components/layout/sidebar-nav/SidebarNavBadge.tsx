import React from 'react';

interface SidebarNavBadgeProps {
  text: string;
  className: string;
}





export default function SidebarNavBadge({ text, className }: SidebarNavBadgeProps) {
  return <span className={className}>{text}</span>;
}
