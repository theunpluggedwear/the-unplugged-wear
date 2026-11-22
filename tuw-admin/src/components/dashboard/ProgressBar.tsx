import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface ProgressBarProps {
  pct: number;
}

export function ProgressBar({ pct }: ProgressBarProps) {
  return (
    <div className={styles.productProgressContainer}>
      <div className={styles.progressBarTrack}>
        <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.progressPercentText}>{pct}%</span>
    </div>
  );
}
