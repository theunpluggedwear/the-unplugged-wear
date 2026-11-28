import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface BarGroupProps {
  pastHeight: string;
  currentHeight: string;
  tooltip: React.ReactNode;
  active?: boolean;
}

export function BarGroup({ pastHeight, currentHeight, tooltip, active = true }: BarGroupProps) {
  return (
    <div className={active ? styles.barGroup : `${styles.barGroup} ${styles.barGroupEmpty}`}>
      <div
        className={`${styles.barColumn} ${styles.barColumnLastWeek}`}
        style={{ height: pastHeight }}
      />
      <div
        className={`${styles.barColumn} ${styles.barColumnThisWeek}`}
        style={{ height: currentHeight }}
      />
      {tooltip}
    </div>
  );
}
