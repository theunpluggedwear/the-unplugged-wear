import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

export interface ChartTooltipRow {
  series: 'past' | 'current';
  label: string;
  value: string;
}

interface ChartTooltipProps {
  title: string;
  rows: ChartTooltipRow[];
}

export function ChartTooltip({ title, rows }: ChartTooltipProps) {
  return (
    <div className={styles.barTooltip}>
      <span className={styles.tooltipDay}>{title}</span>
      {rows.map((row) => (
        <div key={row.label} className={styles.tooltipRow}>
          <span className={row.series === 'current' ? styles.tooltipDotThisWeek : styles.tooltipDotLastWeek} />
          <span className={styles.tooltipLabel}>{row.label}:</span>
          <strong className="tuw-tabular-nums">{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
