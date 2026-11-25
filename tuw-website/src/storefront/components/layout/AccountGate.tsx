'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import { useSession } from '@storefront/lib/session';

// Account pages need a signed-in shopper. proxy.ts already redirects signed-out
// visitors; this is the in-page fallback (e.g. a session that ended mid-visit).
export default function AccountGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSession();
  const pathname = usePathname() || '/account';
  // The full address, query included, so an invite token or order survives login.
  const [returnTo, setReturnTo] = useState(pathname);
  useEffect(() => setReturnTo(`${window.location.pathname}${window.location.search}`), [pathname]);

  // A page restored from the browser's back/forward cache skips the server, so
  // after logging out Back could show it again. Reload instead: the proxy then
  // sends a signed-out visitor to login.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (!ready) return <div className="min-h-screen bg-store-canvas" aria-busy="true" />;
  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-store-cream flex items-center justify-center mx-auto text-store-text-secondary">
            <Lock size={24} aria-hidden="true" />
          </div>
          <h1 className="tuw-h1 text-store-text-primary">
            Log in to see your account
          </h1>
          <p className="text-sm text-store-text-secondary leading-relaxed">
            Your orders, addresses and returns are kept private to your account.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={`/login?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary-dark text-white text-sm font-medium hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
            >
              Log in
            </Link>
            <Link
              href="/track-order"
              className="inline-flex items-center min-h-6 text-sm text-store-text-secondary hover:text-store-text-primary hover:underline"
            >
              Track an order without logging in
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
