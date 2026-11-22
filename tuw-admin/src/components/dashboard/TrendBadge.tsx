import React from 'react';
import { ArrowUp } from 'lucide-react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface TrendBadgeProps {
  value: string;
  tone?: 'up' | 'down';
  iconSize?: number;
  iconStrokeWidth?: number;
}

export function TrendBadge({ value, tone = 'up', iconSize = 14, iconStrokeWidth = 2 }: TrendBadgeProps) {
  return (
    <span className={tone === 'up' ? styles.trendBadgeGreen : styles.trendBadgeRed}>
      <ArrowUp size={iconSize} strokeWidth={iconStrokeWidth} />
      {value}
    </span>
  );
}
