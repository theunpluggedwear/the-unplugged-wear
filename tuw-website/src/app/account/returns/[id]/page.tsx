'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import { getReturnAction, payDifferenceAction } from '@/server/return-actions';
import { formatPaise, formatShortDate } from '@storefront/lib/format';
import type { ReturnDetail } from '@tuw/heart/modules/returns';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  requested: 'With our team',
  approved: 'Approved',
  rejected: 'Not approved',
  pickup_scheduled: 'Pickup scheduled',
  in_transit: 'On its way back',
  received: 'Received at the studio',
  inspected: 'Inspected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Under review',
};
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'dark' | 'outline'> = {
  requested: 'warning', approved: 'info', rejected: 'error', pickup_scheduled: 'neutral', in_transit: 'neutral',
  received: 'info', inspected: 'info', completed: 'success', cancelled: 'neutral', disputed: 'warning',
};
const DISPOSITION_LABEL: Record<string, string> = {
  pending: 'Waiting at the studio', restock: 'Inspected and put back in stock', scrap: 'Written off', return_to_customer: 'Sent back to you',
  exchange: 'Exchanged', replacement: 'Reprinted',
};

const CARD = 'bg-store-surface border border-store-card-border p-6 sm:p-8';

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<ReturnDetail | null | undefined>(undefined);
  const [method, setMethod] = useState<'card' | 'upi'>('upi');
  const [decline, setDecline] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void getReturnAction({ returnId: id }).then((result) => { if (live) setRequest(result.ok ? result.data : null); });
    return () => { live = false; };
  }, [id]);

  const pay = async () => {
    if (!request) return;
    setPaying(true);
    const result = await payDifferenceAction({ returnId: request.id, method, simulate: decline ? 'decline' : undefined });
    setPaying(false);
    if (result.ok) {
      setNotice({ ok: true, text: `Paid ${formatPaise(result.data.paidPaise)} on the demo gateway. ${result.data.orderNumber} is released for printing.` });
      const refreshed = await getReturnAction({ returnId: request.id });
      if (refreshed.ok) setRequest(refreshed.data);
    } else {
      setNotice({ ok: false, text: result.error.message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas text-store-charcoal">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'My account', href: '/account' },
          { label: 'Returns & exchanges', href: '/account/returns' },
          { label: request ? request.rmaNumber : 'Request' },
        ]} />

        {request === undefined ? (
          <p role="status" className="py-16 text-center text-sm text-store-text-secondary">Opening your request…</p>
        ) : request === null ? (
          <div className="py-16 text-center">
            <AlertCircle size={26} aria-hidden="true" className="mx-auto text-store-text-secondary" />
            <h1 className="tuw-h1 mt-4 text-store-charcoal">We couldn’t find that request</h1>
            <p className="mt-2 text-sm text-store-text-secondary">It may belong to another account, or the link is incomplete.</p>
            <div className="mt-6"><Button variant="outline" size="md" href="/account/returns">All my requests</Button></div>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-store-card-border">
              <div>
                <h1 className="tuw-h1 text-store-charcoal">{request.rmaNumber}</h1>
                <p className="mt-2 text-sm text-store-text-secondary">
                  {request.type === 'exchange' ? 'Exchange' : 'Defect replacement'} for order{' '}
                  <Link href={`/account/orders/${encodeURIComponent(request.orderNumber)}`} className="text-store-charcoal underline underline-offset-4 decoration-store-gold">{request.orderNumber}</Link>
                  {' '}· raised {formatShortDate(request.createdAt)}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[request.status] ?? 'neutral'}>{STATUS_LABEL[request.status] ?? request.status}</Badge>
            </div>

            {request.rejectionReason && (
              <div className="mt-6 border-l-2 border-red-300 pl-4 text-sm">
                <p className="font-medium">Why this was not approved</p>
                <p className="mt-1 text-store-text-secondary">{request.rejectionReason}</p>
              </div>
            )}

            {request.status === 'approved' && request.duePaise > 0 && (
              <section className={`mt-6 ${CARD}`} aria-labelledby="pay-heading">
                <h2 id="pay-heading" className="font-heading text-xl font-medium">Pay the difference</h2>
                <p className="mt-1 text-sm text-store-text-secondary">
                  {formatPaise(request.duePaise)} is due for the variant you chose. We start printing {request.replacementOrderNumber ?? 'the new piece'} as soon as it is paid.
                </p>
                <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                  {(['upi', 'card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setMethod(m)}
                      className={`h-10 px-4 text-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${method === m ? 'border-store-charcoal bg-store-cream font-medium' : 'border-store-card-border hover:border-store-charcoal'}`}
                    >
                      {m === 'upi' ? 'UPI' : 'Card'}
                    </button>
                  ))}
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm text-store-text-secondary">
                  <input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} className="mt-1 h-4 w-4 accent-[#111111]" />
                  <span>Simulate a declined payment (demo only)</span>
                </label>
                <p className="mt-3 text-xs text-store-text-secondary">
                  Demo checkout sandbox — no payment will be collected and no card details are asked for.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button variant="dark" size="md" onClick={() => void pay()} isLoading={paying} disabled={paying}>
                    Pay <span className="tuw-tabular-nums">{formatPaise(request.duePaise)}</span> (demo)
                  </Button>
                  <span className="text-xs text-store-text-secondary">Only an approved exchange can be paid here.</span>
                </div>
                {notice && (
                  <p role={notice.ok ? 'status' : 'alert'} className={`mt-3 flex items-start gap-2 text-sm ${notice.ok ? 'text-store-charcoal' : 'text-red-700'}`}>
                    {notice.ok && <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />}
                    {notice.text}
                  </p>
                )}
              </section>
            )}

            {request.duePaise === 0 && request.status === 'approved' && request.type === 'exchange' && (
              <p className="mt-6 text-sm text-store-text-secondary">No price difference on this exchange — {request.replacementOrderNumber} is already released for printing.</p>
            )}

            <section className={`mt-6 ${CARD}`} aria-labelledby="items-heading">
              <h2 id="items-heading" className="font-heading text-xl font-medium">Items</h2>
              <ul className="mt-4 divide-y divide-store-card-border">
                {request.lines.map((line) => (
                  <li key={line.id} className="py-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{line.productName}</span>
                      <span className="text-store-text-secondary">Qty {line.qty}</span>
                    </div>
                    <p className="mt-1 text-store-text-secondary">
                      {line.variantLabel}
                      {line.exchangeVariantLabel ? ` → ${line.exchangeVariantLabel}` : ''}
                    </p>
                    {line.conditionNote && <p className="mt-1 text-store-text-secondary">You wrote: “{line.conditionNote}”</p>}
                    <p className="mt-1 text-xs text-store-text-secondary">{DISPOSITION_LABEL[line.disposition] ?? line.disposition}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`mt-6 ${CARD}`} aria-labelledby="history-heading">
              <h2 id="history-heading" className="font-heading text-xl font-medium">What has happened</h2>
              <ol className="mt-4 space-y-4">
                {request.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 text-sm">
                    <span className="text-store-text-secondary tuw-tabular-nums">{formatShortDate(h.at)}</span>
                    <span>
                      <span className="font-medium">{STATUS_LABEL[h.status] ?? h.status}</span>
                      {h.note && <span className="block text-store-text-secondary mt-0.5">{h.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {request.carrier && (
                <p className="mt-4 pt-4 border-t border-store-card-border text-sm text-store-text-secondary">
                  Pickup with {request.carrier}{request.trackingNumber ? ` · ${request.trackingNumber}` : ''}
                </p>
              )}
              {request.evidence > 0 && (
                <p className="mt-3 text-xs text-store-text-secondary">{request.evidence} photo{request.evidence === 1 ? '' : 's'} attached (demo sandbox).</p>
              )}
            </section>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="outline" size="md" href="/account/returns" icon={<ArrowLeft size={16} />}>All my requests</Button>
              <Button variant="ghost" size="md" href={`/account/orders/${encodeURIComponent(request.orderNumber)}`}>View the order</Button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
