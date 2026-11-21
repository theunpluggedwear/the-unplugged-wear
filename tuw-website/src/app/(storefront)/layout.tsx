import type { ReactNode } from 'react';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';

/**
 * Shared storefront chrome. Header and Footer are rendered once here instead
 * of in every page, so the client Header stays mounted while navigating
 * between storefront routes and its effects no longer re-run on each route
 * change (CLN-NXT-003). Each page contributes only its <main>.
 *
 * `bg-store-canvas` matches the <body> background in the root layout, so the
 * moved pages keep their exact painted canvas; `min-h-screen flex flex-col`
 * keeps the footer pinned to the bottom on short pages.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
