// Formatters — currency, dates, order ids. Pure functions only.
// Canonical en-IN currency formatter (always two fraction digits) now lives in
// heart; the local clone was removed without changing the rendered output.
import type { CSSProperties } from 'react';
export { formatINRFixed as formatINR } from '@tuw/heart/platform/money';

/** Shared token-based treatment for non-clickable machine identifiers. */
export const MONO_ID_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  color: 'var(--tuw-text-info)',
  fontVariantNumeric: 'tabular-nums',
};

export function formatDate(d: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(d));
}

export function formatDateTime(d: string | Date): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
