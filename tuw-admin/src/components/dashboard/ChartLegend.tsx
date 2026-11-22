import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface ChartLegendProps {
  past: string;
  current: string;
}

export function ChartLegend({ past, current }: ChartLegendProps) {
  return (
    <div className={styles.chartLegend}>
      <span className={styles.legendItem}>
        <span className={styles.legendDotLastWeek} />
        {past}
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendDotThisWeek} />
        {current}
      </span>
    </div>
  );
}
