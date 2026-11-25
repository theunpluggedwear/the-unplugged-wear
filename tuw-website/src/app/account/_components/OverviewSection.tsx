'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, MapPin, Package, RotateCcw, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Button from '@storefront/components/ui/Button';
import { useStore } from '@storefront/mocks/store';
import { formatPaise, formatShortDate } from '@storefront/lib/format';
import { useAccountPage } from './AccountShell';
import { OrderProgress, RETURN_WINDOW_DAYS, StatusPills, orderPaise } from './account-helpers';

const linkClass =
  'inline-flex items-center gap-1 text-sm font-medium text-store-charcoal underline underline-offset-4 decoration-store-gold hover:decoration-store-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold';

function Tile({
  href,
  icon: Icon,
  title,
  children,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  cta: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group h-full flex flex-col gap-3 p-5 border border-store-card-border bg-store-surface hover:border-store-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
      >
        <span className="flex items-center gap-2.5 text-store-charcoal">
          <Icon size={18} aria-hidden="true" />
          <span className="font-heading text-base font-medium">{title}</span>
        </span>
        <span className="flex-1 text-sm text-store-text-secondary leading-relaxed">{children}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-store-charcoal group-hover:underline underline-offset-4 decoration-store-gold">
          {cta}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

/** /account — the account at a glance: latest order, then a tile per section. */
export default function OverviewSection() {
  const { myOrders, account } = useAccountPage();
  const { orders, loaded, claimable } = myOrders;
  const { addresses } = account;
  const phone = account.account?.profile.phone;
  const { wishlist } = useStore();

  const latestOrder = orders[0];
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const inProgress = orders.filter((o) => o.fulfillmentStatus !== 'delivered' && o.fulfillmentStatus !== 'cancelled').length;

  return (
    <div className="space-y-8">
      {claimable.count > 0 && (
        <p className="p-4 border border-store-card-border bg-store-cream text-sm text-store-charcoal">
          You have {claimable.count} guest order{claimable.count === 1 ? '' : 's'} placed with this email.{' '}
          <Link href="/account/orders" className={linkClass}>
            Add {claimable.count === 1 ? 'it' : 'them'} to your account
          </Link>
        </p>
      )}

      {/* Latest order */}
      <section aria-labelledby="latest-order-heading" className="border border-store-card-border bg-store-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="latest-order-heading" className="text-xs uppercase tracking-wider text-store-text-secondary">
              Latest order
            </h2>
            {latestOrder && (
              <p className="mt-1.5 text-base font-medium text-store-charcoal">
                {latestOrder.orderNumber}
                <span className="ml-2 text-sm font-normal text-store-text-secondary">
                  {formatShortDate(latestOrder.date)} · <span className="tuw-tabular-nums">{formatPaise(orderPaise(latestOrder).total)}</span>
                </span>
              </p>
            )}
          </div>
          {latestOrder && <StatusPills order={latestOrder} />}
        </div>

        {!loaded ? (
          <p role="status" className="text-sm text-store-text-secondary">Loading your orders…</p>
        ) : latestOrder ? (
          <>
            <OrderProgress order={latestOrder} />
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="dark" size="sm" href={`/account/orders/${encodeURIComponent(latestOrder.orderNumber)}`}>
                View order
              </Button>
              <Link href="/account/orders" className={linkClass}>
                All orders
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-store-text-secondary">You haven’t placed an order yet. Everything is printed after you order it.</p>
            <Button variant="dark" size="sm" href="/shop">
              Explore the collection
            </Button>
          </div>
        )}
      </section>

      {/* Sections at a glance */}
      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading" className="sr-only">Your account</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Tile href="/account/orders" icon={Package} title="Orders" cta="Order history">
            {!loaded
              ? 'Loading…'
              : orders.length === 0
              ? 'No orders yet.'
              : `${orders.length} order${orders.length === 1 ? '' : 's'}${inProgress ? ` · ${inProgress} in progress` : ''}.`}
          </Tile>
          <Tile href="/account/addresses" icon={MapPin} title="Addresses" cta={defaultAddress ? 'Manage addresses' : 'Add an address'}>
            {defaultAddress ? (
              <>
                {defaultAddress.label ? `${defaultAddress.label} · ` : ''}
                {defaultAddress.fullName}, {defaultAddress.addressLine1}, {defaultAddress.city} {defaultAddress.postalCode}
              </>
            ) : (
              'No saved address yet. Save one to check out faster.'
            )}
          </Tile>
          <Tile href="/account/returns" icon={RotateCcw} title="Returns & exchanges" cta="Returns">
            Ask for a different size or report a problem within {RETURN_WINDOW_DAYS} days of delivery.
          </Tile>
          <Tile href="/account/profile" icon={User} title="Profile" cta="Edit profile">
            {phone ? `${phone} · ` : ''}Name, phone number and password.
          </Tile>
          <Tile href="/account/wishlist" icon={Heart} title="Wishlist" cta="View wishlist">
            {wishlist.length === 0 ? 'Nothing saved yet.' : `${wishlist.length} saved piece${wishlist.length === 1 ? '' : 's'}.`}
          </Tile>
        </ul>
      </section>
    </div>
  );
}
