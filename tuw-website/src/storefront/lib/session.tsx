'use client';

import { createContext, use, useCallback, useContext, type ReactNode } from 'react';
import { logoutAction } from '@/server/auth-actions';

// Real shopper session for client components (replaces the demo
// localStorage session). The root layout passes an un-awaited promise;
// components read it with use() inside a <Suspense> boundary
// (nextjs-rendering / auth-guards skills).

export interface SessionSummary {
  name: string;
  email: string;
}

const SessionContext = createContext<Promise<SessionSummary | null> | null>(null);

export function SessionProvider({ session, children }: { session: Promise<SessionSummary | null>; children: ReactNode }) {
  return <SessionContext value={session}>{children}</SessionContext>;
}

/** Suspends until the session is known — render inside <Suspense>. */
export function useSession() {
  const promise = useContext(SessionContext);
  const session = promise ? use(promise) : null;
  /**
   * The one logout path (header menu, account menu, mobile menu). Ends the
   * session, then does a full page load of the home page that *replaces* the
   * current history entry: every page Next kept alive in memory (with orders,
   * addresses…) is dropped, and Back cannot return to the page you left.
   * Resolves `false` (and stays put) if the server could not log you out.
   */
  const signOut = useCallback(async (): Promise<boolean> => {
    try {
      const result = await logoutAction({});
      if (!result.ok) return false;
    } catch {
      return false;
    }
    window.location.replace('/');
    return true;
  }, []);
  return { session, ready: true as const, signOut };
}
