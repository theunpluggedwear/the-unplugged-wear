'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import { myReturnsAction } from '@/server/return-actions';
import { formatPaise, formatShortDate } from '@storefront/lib/format';
import { RETURN_WINDOW_DAYS } from '@storefront/lib/product';
import type { ReturnDetail } from '@tuw/heart/modules/returns';
import { RotateCcw, ArrowRight, Undo2 } from 'lucide-react';

const TYPE_LABEL = { exchange: 'Exchange', replacement: 'Replacement' } as const;

const STATUS_LABEL: Record<string, string> = {
  requested: 'With our team',
  approved: 'Approved',
  rejected: 'Not approved',
  pickup_scheduled: 'Pickup scheduled',
  in_transit: 'On its way back',
  received: 'Received',
  inspected: 'Inspected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Under review',
};
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'dark' | 'outline'> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'error',
  pickup_scheduled: 'neutral',
  in_transit: 'neutral',
  received: 'info',
  inspected: 'info',
  completed: 'success',
  cancelled: 'neutral',
  disputed: 'warning',
};

export default function AccountReturnsPage() {
  const [requests, setRequests] = useState<ReturnDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void myReturnsAction({}).then((result) => {
      if (!live) return;
      if (result.ok) setRequests(result.data);
      else { setError(result.error.message); setRequests([]); }
    });
    return () => { live = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'My account', href: '/account' }, { label: 'Returns & exchanges' }]} />

        <div className="mt-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-store-card-border">
          <div>
            <h1 className="font-heading text-[clamp(1.75rem,2.5vw+1rem,2.5rem)] font-medium tracking-tight text-store-charcoal">Returns & exchanges</h1>
            <p className="mt-2 text-sm text-store-text-secondary max-w-xl">
              Ask for a different size, or let us know something arrived less than perfect. Each request is reviewed by a person, usually within two working days.
            </p>
          </div>
          <Button variant="dark" size="md" href="/account/returns/new">
            Start a request
          </Button>
        </div>

        {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}

        {requests === null ? (
          <p role="status" className="py-16 text-center text-sm text-store-text-secondary">Loading your requests…</p>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center border border-store-card-border bg-store-surface mt-8 px-6">
            <Undo2 size={26} aria-hidden="true" className="mx-auto text-store-text-secondary" />
            <h2 className="mt-4 font-heading text-xl font-medium text-store-charcoal">Nothing to return right now</h2>
            <p className="mt-2 text-sm text-store-text-secondary max-w-md mx-auto">
              Once a parcel is delivered, you can ask for an exchange or a defect replacement here for {RETURN_WINDOW_DAYS} days.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Button variant="outline" size="md" href="/account/orders">View my orders</Button>
              <Button variant="dark" size="md" href="/account/returns/new">Start a request</Button>
            </div>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-store-card-border border-y border-store-card-border">
            {requests.map((request) => (
              <li key={request.id}>
                <Link href={`/account/returns/${request.id}`} className="block py-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-store-charcoal tuw-tabular-nums">{request.rmaNumber}</span>
                        <Badge variant={STATUS_VARIANT[request.status] ?? 'neutral'} size="sm">{STATUS_LABEL[request.status] ?? request.status}</Badge>
                        <Badge variant="outline" size="sm">{TYPE_LABEL[request.type]}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-store-text-secondary">
                        Order {request.orderNumber} · {request.itemCount} {request.itemCount === 1 ? 'item' : 'items'} · asked {formatShortDate(request.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-store-text-secondary">
                        {request.lines.map((l) => `${l.productName} (${l.variantLabel})`).join(', ')}
                      </p>
                      {request.status === 'approved' && request.duePaise > 0 && (
                        <p className="mt-1.5 text-sm text-store-charcoal">
                          <span className="tuw-tabular-nums">{formatPaise(request.duePaise)}</span> difference is due to release {request.replacementOrderNumber}.
                        </p>
                      )}
                      {request.rejectionReason && (
                        <p className="mt-1.5 text-sm text-store-text-secondary">Our note: {request.rejectionReason}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-store-charcoal group-hover:underline underline-offset-4 decoration-store-gold">
                      {request.status === 'approved' && request.duePaise > 0 ? 'Pay difference' : 'Details'}
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 flex items-start gap-2 text-sm text-store-text-secondary">
          <RotateCcw size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Unworn pieces can be exchanged within {RETURN_WINDOW_DAYS} days of delivery. Defects are always our responsibility —{' '}
            <Link href="/policies/returns" className="text-store-charcoal underline underline-offset-4 decoration-store-gold">read the returns policy</Link>.
          </span>
        </p>
      </main>
      <Footer />
    </div>
  );
}
