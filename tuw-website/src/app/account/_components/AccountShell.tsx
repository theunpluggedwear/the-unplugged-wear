'use client';

import React, { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, LayoutGrid, LogOut, MapPin, Package, RotateCcw, User } from 'lucide-react';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import { useStore } from '@storefront/mocks/store';
import { useSession } from '@storefront/lib/session';
import { useAccount } from '@storefront/lib/account';
import { useMyOrders } from '@storefront/lib/my-orders';

/** One web address per account section. */
export const ACCOUNT_SECTIONS = [
  { href: '/account', label: 'Overview', icon: LayoutGrid },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/returns', label: 'Returns', icon: RotateCcw },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/profile', label: 'Profile', icon: User },
] as const;

type AccountPageData = {
  myOrders: ReturnType<typeof useMyOrders>;
  account: ReturnType<typeof useAccount>;
};

const AccountPageContext = createContext<AccountPageData | null>(null);

/**
 * Orders and the address book, loaded once by the shell and shared with the
 * section on screen, so an edit (e.g. a new default address) shows everywhere.
 */
export function useAccountPage(): AccountPageData {
  const value = useContext(AccountPageContext);
  if (!value) throw new Error('useAccountPage must be used inside <AccountShell>');
  return value;
}

const navItemClass = (isActive: boolean) =>
  `inline-flex lg:flex items-center gap-2.5 whitespace-nowrap px-4 lg:px-3 py-2.5 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${
    isActive
      ? 'bg-store-charcoal text-white lg:bg-store-cream lg:text-store-charcoal lg:font-medium lg:border-l-2 lg:border-store-charcoal'
      : 'text-store-text-secondary hover:text-store-charcoal border border-store-border lg:border-0 lg:border-l-2 lg:border-transparent'
  }`;

/**
 * Frame shared by every account section page: header, title, section menu
 * (real links, so Back, refresh and bookmarks work) and the demo-data note. Lives in the (sections) layout, so it stays mounted —
 * and keeps its loaded data — while the shopper moves between sections.
 */
export default function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Overview matches only /account itself; sections also match their sub-pages.
  const isActiveSection = (href: string) =>
    href === '/account' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const current = ACCOUNT_SECTIONS.find(({ href }) => isActiveSection(href));
  const { wishlist, resetStoreData } = useStore();
  const { session, signOut } = useSession();
  const myOrders = useMyOrders();
  const account = useAccount();

  const { orders } = myOrders;
  const { addresses } = account;
  const counts: Record<string, number | null> = {
    '/account/orders': orders.length,
    '/account/addresses': addresses.length,
    '/account/wishlist': wishlist.length,
  };

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    const ok = await signOut(); // navigates away on success
    if (!ok) {
      setSigningOut(false);
      setSignOutError(true);
    }
  };

  return (
    <AccountPageContext value={{ myOrders, account }}>
      <div className="min-h-screen flex flex-col bg-store-canvas text-store-text-primary">
        <Header />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
          <Breadcrumb
            items={
              current?.href === '/account'
                ? [{ label: 'Home', href: '/' }, { label: 'My account' }]
                : [{ label: 'Home', href: '/' }, { label: 'My account', href: '/account' }, { label: current?.label ?? '' }]
            }
          />

          <div className="mt-6 mb-8 sm:mb-10">
            <h1 className="tuw-h1 text-store-charcoal">
              My account
            </h1>
            <p className="text-sm text-store-text-secondary mt-1">
              Welcome back, {session?.name ?? ''} · {session?.email ?? ''}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-12">
            {/* Section navigation: sideways-scrolling row on phones, side menu on desktop */}
            <nav aria-label="Account sections" className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <ul className="flex lg:flex-col gap-2 lg:gap-0.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                {ACCOUNT_SECTIONS.map(({ href, label, icon: Icon }) => {
                  const isActive = isActiveSection(href);
                  const count = counts[href] ?? null;
                  return (
                    <li key={href} className="shrink-0">
                      <Link
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`${navItemClass(isActive)} w-full rounded-full lg:rounded-none`}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{label}</span>
                        {count !== null && (
                          <span className="ml-auto pl-2 text-xs opacity-70 tuw-tabular-nums">{count}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                <li className="shrink-0 lg:mt-4 lg:pt-4 lg:border-t lg:border-store-border">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    aria-busy={signingOut || undefined}
                    className={`${navItemClass(false)} w-full rounded-full lg:rounded-none disabled:opacity-60 disabled:cursor-wait`}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>{signingOut ? 'Logging out…' : 'Log out'}</span>
                  </button>
                  {signOutError && (
                    <p role="alert" className="mt-2 px-3 text-xs text-store-terracotta">
                      Couldn’t log you out. Please try again.
                    </p>
                  )}
                </li>
              </ul>
            </nav>

            <div className="min-w-0 space-y-8">
              {children}
            </div>
          </div>

          {/* Demo controls, kept apart from the customer actions */}
          <aside className="mt-16 pt-6 border-t border-dashed border-store-card-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-store-text-secondary">
              Demo store: your orders, returns, profile and addresses are saved to your account. Resetting clears only the demo data kept in this browser.
            </p>
            <button
              type="button"
              onClick={resetStoreData}
              className="self-start sm:self-auto text-xs font-medium text-store-charcoal underline underline-offset-4 decoration-store-card-border hover:decoration-store-charcoal cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
            >
              Reset demo data
            </button>
          </aside>
        </main>

        <Footer />
      </div>
    </AccountPageContext>
  );
}
