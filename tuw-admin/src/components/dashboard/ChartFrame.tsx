import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface ChartFrameProps {
  ticks: string[];
  labels: string[];
  children: React.ReactNode;
}

export function ChartFrame({ ticks, labels, children }: ChartFrameProps) {
  return (
    <div className={styles.chartContainer}>
      <div className={`${styles.yAxisLabels} tuw-tabular-nums`}>
        {ticks.map((tick, i) => (
          <span key={`tick-${i}`}>{tick}</span>
        ))}
      </div>

      <div className={styles.chartPlotArea}>
        <div className={styles.gridLinesWrapper} aria-hidden="true">
          {ticks.map((tick, i) => (
            <div key={`grid-${i}`} className={styles.gridLine} />
          ))}
        </div>

        <div className={styles.barsArea}>{children}</div>

        <div className={styles.xAxisLabels}>
          {labels.map((label, i) => (
            <span key={`x-${i}`} className={styles.xAxisDay}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
