'use client';

import { useEffect, useState } from 'react';

// Where to send a shopper after login / sign-up (?next=). Only same-site paths
// are honoured so ?next= can never bounce someone off the store; the server
// actions re-check with the same rule (safeNext in @tuw/heart).

export const DEFAULT_NEXT = '/account';

/** A same-site path, or `null` when the value is missing or points elsewhere. */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  // "//host" and "/\host" are treated as another site by browsers.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** The safe ?next= of the current URL, or the fallback. Call in handlers/effects only. */
export function readNextPath(fallback: string = DEFAULT_NEXT): string {
  if (typeof window === 'undefined') return fallback;
  return sanitizeNext(new URLSearchParams(window.location.search).get('next')) ?? fallback;
}

/** `path` with the return address attached, e.g. `/register?next=%2Fcheckout`. */
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/**
 * The page's safe ?next= for links (e.g. "Create an account"), read after
 * hydration so server and client render the same first HTML. `null` = none.
 */
export function useNextParam(): string | null {
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setNext(sanitizeNext(new URLSearchParams(window.location.search).get('next')));
  }, []);
  return next;
}
