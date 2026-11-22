import React from 'react';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface OnlineBadgeProps {
  label: string;
}

export function OnlineBadge({ label }: OnlineBadgeProps) {
  return (
    <div className={styles.onlineBadge}>
      <span className={styles.pulseDot} />
      <span>{label}</span>
    </div>
  );
}
