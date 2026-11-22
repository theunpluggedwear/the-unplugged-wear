import React from 'react';
import { buildSparkPath } from '@/lib/dashboard';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

export type SparklineTone = 'up' | 'down';

interface SparklineProps {
  tone: SparklineTone;
  label?: string;
  values?: number[];
}

export function Sparkline({ tone, label, values }: SparklineProps) {
  const gradId = React.useId();
  const isUp = tone === 'up';
  const linePath = values ? buildSparkPath(values, tone) : buildSparkPath([], tone);
  const stroke = isUp ? '#00CB75' : '#E94845';
  const wash = isUp ? '#C6EAA0' : '#E94845';
  const washOpacity = isUp ? '0.7' : '0.4';
  return (
    <svg className={styles.kpiSparkline} viewBox="0 0 90 40" fill="none" role="img" aria-label={label ?? (isUp ? 'Upward trend' : 'Downward trend')}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={wash} stopOpacity={washOpacity} />
          <stop offset="100%" stopColor={wash} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linePath} L 90 40 L 0 40 Z`} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
