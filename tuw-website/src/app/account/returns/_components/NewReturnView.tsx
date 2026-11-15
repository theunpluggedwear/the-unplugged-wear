'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import Badge from '@storefront/components/ui/Badge';
import Button from '@storefront/components/ui/Button';
import { createReturnAction, recordReturnEvidenceAction, returnEligibilityAction, returnableOrdersAction } from '@/server/return-actions';
import { formatPaise, formatShortDate } from '@storefront/lib/format';
import type { CreateReturnInput, ReturnEligibility } from '@tuw/heart/modules/returns';
import { AlertCircle, ImagePlus, Info } from 'lucide-react';

type ReturnType = 'exchange' | 'replacement';

const REASONS: Record<ReturnType, { value: string; label: string }[]> = {
  exchange: [
    { value: 'size_fit', label: 'The size or fit is not right' },
    { value: 'wrong_variant', label: 'I chose the wrong colour or size' },
  ],
  replacement: [
    { value: 'damaged', label: 'Arrived damaged' },
    { value: 'misprint', label: 'Print is misaligned or faded' },
    { value: 'wrong_item', label: 'I received the wrong item' },
    { value: 'quality', label: 'The print quality is not what I expected' },
  ],
};

interface Picked {
  checked: boolean;
  qty: number;
  reasonCode: string;
  exchangeVariantId: string;
  conditionNote: string;
}

const CARD = 'bg-store-surface border border-store-card-border p-6 sm:p-8';
const LABEL = 'block text-sm font-medium text-store-charcoal';

export default function NewReturnView({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const router = useRouter();
  const [orders, setOrders] = useState<{ orderNumber: string; deliveredAt: string; deadline: string | null; itemCount: number }[] | null>(null);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? '');
  const [eligibility, setEligibility] = useState<ReturnEligibility | null>(null);
  const [loading, setLoading] = useState(Boolean(initialOrderNumber));
  const [type, setType] = useState<ReturnType>('exchange');
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [unboxingVideo, setUnboxingVideo] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per attempt tree: a retry after a failure reuses it, so the same
  // request is never created twice. Reset only after a successful create.
  const requestKey = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    let live = true;
    void returnableOrdersAction({}).then((result) => { if (live) setOrders(result.ok ? result.data : []); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!orderNumber) { setEligibility(null); return; }
    let live = true;
    setLoading(true);
    setError(null);
    setPicked({});
    void returnEligibilityAction({ orderNumber }).then((result) => {
      if (!live) return;
      setLoading(false);
      if (result.ok) setEligibility(result.data);
      else { setEligibility(null); setError(result.error.message); }
    });
    return () => { live = false; };
  }, [orderNumber]);

  const lines = eligibility?.lines ?? [];
  const needsUnboxingVideo = type === 'replacement' && Object.values(picked).some((p) => p.checked && p.reasonCode === 'wrong_item');
  const chosen = Object.entries(picked).filter(([, p]) => p.checked);
  const priceDifference = useMemo(() => {
    if (type !== 'exchange') return 0;
    return chosen.reduce((sum, [itemId, p]) => {
      const line = lines.find((l) => l.orderItemId === itemId);
      const variant = line?.exchangeVariants.find((v) => v.id === p.exchangeVariantId);
      if (!line || !variant) return sum;
      return sum + (variant.pricePaise - line.unitPaise) * p.qty;
    }, 0);
  }, [chosen, lines, type]);

  const setLine = (itemId: string, patch: Partial<Picked>) =>
    setPicked((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? { checked: false, qty: 1, reasonCode: '', exchangeVariantId: '', conditionNote: '' }), ...patch } }));

  const submit = async () => {
    setError(null);
    if (!eligibility) return;
    const items = chosen.map(([orderItemId, p]) => ({
      orderItemId,
      qty: p.qty,
      reasonCode: p.reasonCode as CreateReturnInput['items'][number]['reasonCode'],
      exchangeVariantId: type === 'exchange' ? p.exchangeVariantId || undefined : undefined,
      conditionNote: p.conditionNote.trim() || undefined,
    }));
    if (!items.length) { setError('Choose at least one item.'); return; }
    if (type === 'exchange' && items.some((i) => !i.exchangeVariantId)) { setError('Choose the variant you would like instead for every item.'); return; }
    if (!files.length) { setError('Add at least one photo so we can see the item.'); return; }
    if (needsUnboxingVideo && !unboxingVideo) { setError('For a wrong item we need the unboxing video our printer requires. Please confirm you have it.'); return; }

    setSubmitting(true);
    const evidence = await recordReturnEvidenceAction({
      files: files.map((f) => ({ name: f.name, mimeType: f.type, sizeBytes: f.size })),
    });
    if (!evidence.ok) { setSubmitting(false); setError(evidence.error.message); return; }
    const result = await createReturnAction({
      orderNumber: eligibility.orderNumber,
      type,
      items,
      note: note.trim() || undefined,
      evidenceMediaIds: evidence.data,
      unboxingVideo: needsUnboxingVideo ? unboxingVideo : false,
      requestKey: requestKey.current,
    });
    setSubmitting(false);
    if (!result.ok) {
      // Nothing typed is lost: the form keeps every choice for a correction.
      setError(result.error.message);
      return;
    }
    requestKey.current = crypto.randomUUID();
    router.push(`/account/returns/${result.data.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas text-store-charcoal">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'My account', href: '/account' },
          { label: 'Returns & exchanges', href: '/account/returns' },
          { label: 'New request' },
        ]} />

        <h1 className="mt-8 font-heading text-[clamp(1.75rem,2.5vw+1rem,2.5rem)] font-medium tracking-tight">Exchange or replacement</h1>
        <p className="mt-2 text-sm text-store-text-secondary max-w-xl">
          Tell us what happened and what you would like instead. A photo helps; a person reads every request.
        </p>

        <section className={`mt-8 ${CARD}`} aria-labelledby="order-heading">
          <h2 id="order-heading" className="font-heading text-xl font-medium">Which order?</h2>
          {orders === null ? (
            <p role="status" className="mt-3 text-sm text-store-text-secondary">Checking your delivered orders…</p>
          ) : orders.length === 0 ? (
            <p className="mt-3 text-sm text-store-text-secondary">
              No delivered orders are inside the exchange window.{' '}
              <Link href="/account/orders" className="text-store-charcoal underline underline-offset-4 decoration-store-gold">View my orders</Link>
            </p>
          ) : (
            <div className="mt-4">
              <label htmlFor="return-order" className={LABEL}>Delivered order</label>
              <select
                id="return-order"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="mt-2 w-full h-11 px-3 border border-store-card-border bg-store-surface text-sm text-store-charcoal rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                <option value="">Choose an order…</option>
                {orders.map((o) => (
                  <option key={o.orderNumber} value={o.orderNumber}>
                    {o.orderNumber} — delivered {formatShortDate(o.deliveredAt)}{o.deadline ? ` · until ${formatShortDate(o.deadline)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {loading && <p role="status" className="mt-6 text-sm text-store-text-secondary">Opening the order…</p>}

        {eligibility && !eligibility.canRequest && (
          <div className="mt-6 border-l-2 border-store-terracotta pl-4 text-sm text-store-charcoal" role="alert">
            <p className="font-medium">Requests are closed for this order.</p>
            <p className="mt-1 text-store-text-secondary">{eligibility.blockedReason}</p>
          </div>
        )}

        {eligibility?.canRequest && (
          <>
            <section className={`mt-6 ${CARD}`} aria-labelledby="type-heading">
              <h2 id="type-heading" className="font-heading text-xl font-medium">What would you like?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="type-heading">
                {([
                  { value: 'exchange', title: 'A different size or variant', body: 'Same piece, another fit or colour. Any price difference is shown before you send it.' },
                  { value: 'replacement', title: 'A defect replacement', body: 'Something is wrong with the print or the piece arrived damaged. We reprint it free.' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={type === option.value}
                    onClick={() => { setType(option.value); setPicked({}); }}
                    className={`text-left p-4 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${type === option.value ? 'border-store-charcoal bg-store-cream' : 'border-store-card-border hover:border-store-charcoal'}`}
                  >
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="mt-1 block text-sm text-store-text-secondary">{option.body}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={`mt-6 ${CARD}`} aria-labelledby="items-heading">
              <h2 id="items-heading" className="font-heading text-xl font-medium">Items</h2>
              <p className="mt-1 text-sm text-store-text-secondary">Only items that can be {type === 'exchange' ? 'exchanged' : 'replaced'} on this order are listed.</p>
              <ul className="mt-5 divide-y divide-store-card-border">
                {lines.map((line) => {
                  const offered = type === 'exchange' ? line.canExchange : line.canReplace;
                  const p = picked[line.orderItemId];
                  const remaining = line.qty - line.returnedQty;
                  const reasons = type === 'exchange'
                    ? REASONS.exchange
                    : REASONS.replacement.filter((r) => r.value !== 'wrong_item' || line.canReplace);
                  return (
                    <li key={line.orderItemId} className="py-5">
                      <div className="flex items-start gap-3">
                        <input
                          id={`line-${line.orderItemId}`}
                          type="checkbox"
                          checked={Boolean(p?.checked)}
                          disabled={!offered || remaining <= 0}
                          onChange={(e) => setLine(line.orderItemId, { checked: e.target.checked, qty: 1, reasonCode: type === 'exchange' ? 'size_fit' : 'damaged' })}
                          className="mt-1 h-4 w-4 accent-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                        />
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`line-${line.orderItemId}`} className="block text-sm font-medium">{line.productName}</label>
                          <p className="text-sm text-store-text-secondary">{line.variantLabel} · Qty {line.qty} · <span className="tuw-tabular-nums">{formatPaise(line.unitPaise)}</span></p>
                          {!offered && (
                            <p className="mt-1 text-xs text-store-text-secondary">
                              {line.exchangeReason ?? 'This piece is final sale and cannot be exchanged.'}
                            </p>
                          )}
                          {offered && remaining <= 0 && <p className="mt-1 text-xs text-store-text-secondary">Already on a request.</p>}
                        </div>
                      </div>

                      {p?.checked && offered && (
                        <div className="mt-4 ml-7 grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`qty-${line.orderItemId}`} className={LABEL}>How many?</label>
                            <select
                              id={`qty-${line.orderItemId}`}
                              value={p.qty}
                              onChange={(e) => setLine(line.orderItemId, { qty: Number(e.target.value) })}
                              className="mt-2 w-full h-11 px-3 border border-store-card-border bg-store-surface text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                            >
                              {Array.from({ length: remaining }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`reason-${line.orderItemId}`} className={LABEL}>Reason</label>
                            <select
                              id={`reason-${line.orderItemId}`}
                              value={p.reasonCode}
                              onChange={(e) => setLine(line.orderItemId, { reasonCode: e.target.value })}
                              className="mt-2 w-full h-11 px-3 border border-store-card-border bg-store-surface text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                            >
                              {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          {type === 'exchange' && (
                            <div className="sm:col-span-2">
                              <label htmlFor={`variant-${line.orderItemId}`} className={LABEL}>Which variant instead?</label>
                              <select
                                id={`variant-${line.orderItemId}`}
                                value={p.exchangeVariantId}
                                onChange={(e) => setLine(line.orderItemId, { exchangeVariantId: e.target.value })}
                                className="mt-2 w-full h-11 px-3 border border-store-card-border bg-store-surface text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                              >
                                <option value="">Choose a variant…</option>
                                {line.exchangeVariants.map((v) => (
                                  <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                                    {v.label} — {formatPaise(v.pricePaise)}{v.stock <= 0 ? ' (out of stock)' : ''}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-store-text-secondary">The price difference, if any, is collected before the new piece is printed.</p>
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label htmlFor={`note-${line.orderItemId}`} className={LABEL}>Anything about this item? (optional)</label>
                            <input
                              id={`note-${line.orderItemId}`}
                              type="text"
                              value={p.conditionNote}
                              maxLength={500}
                              onChange={(e) => setLine(line.orderItemId, { conditionNote: e.target.value })}
                              placeholder="e.g. The print is faded near the hem"
                              className="mt-2 w-full h-11 px-3 border border-store-card-border bg-store-surface text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {lines.length === 0 && <p className="mt-4 text-sm text-store-text-secondary">This order has no items left to request.</p>}
            </section>

            <section className={`mt-6 ${CARD}`} aria-labelledby="evidence-heading">
              <h2 id="evidence-heading" className="font-heading text-xl font-medium">Photos</h2>
              <p className="mt-1 text-sm text-store-text-secondary">At least one photo of the piece. On mobile you can take it now.</p>
              <label className="mt-4 inline-flex items-center gap-2 h-11 px-5 border border-store-card-border text-sm font-medium cursor-pointer hover:border-store-charcoal focus-within:ring-2 focus-within:ring-store-gold">
                <ImagePlus size={16} aria-hidden="true" />
                Choose photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-3 text-sm text-store-text-secondary space-y-1">
                  {files.map((f) => <li key={`${f.name}-${f.size}`}>{f.name} · {(f.size / 1024).toFixed(0)} KB</li>)}
                </ul>
              )}
              {files.length > 0 && <p className="mt-2 text-xs text-store-text-secondary">Demo sandbox — photos are recorded by name; nothing is uploaded to storage yet.</p>}

              {needsUnboxingVideo && (
                <div className="mt-5 border-t border-store-card-border pt-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={unboxingVideo} onChange={(e) => setUnboxingVideo(e.target.checked)} className="mt-1 h-4 w-4 accent-[#111111]" />
                    <span>
                      I have the unboxing video for this order.
                      <span className="block text-xs text-store-text-secondary">Our print partner requires it for wrong or missing items before a reprint is approved.</span>
                    </span>
                  </label>
                </div>
              )}
            </section>

            <section className={`mt-6 ${CARD}`} aria-labelledby="note-heading">
              <h2 id="note-heading" className="font-heading text-xl font-medium">A note for our team (optional)</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Anything we should know before we reply"
                className="mt-3 w-full p-3 border border-store-card-border bg-store-surface text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              />
            </section>
          </>
        )}

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-2 border border-red-200 bg-red-50 text-red-800 p-4 text-sm">
            <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {eligibility?.canRequest && (
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-store-text-secondary">
              {type === 'exchange' ? (
                priceDifference === 0 ? 'No price difference on this exchange.' : priceDifference > 0
                  ? <>To pay if approved: <span className="text-store-charcoal tuw-tabular-nums">{formatPaise(priceDifference)}</span></>
                  : <>We will refund <span className="text-store-charcoal tuw-tabular-nums">{formatPaise(-priceDifference)}</span> if approved.</>
              ) : 'A defect replacement is free — no payment is collected.'}
            </div>
            <Button variant="dark" size="lg" onClick={() => void submit()} isLoading={submitting} disabled={chosen.length === 0 || submitting}>
              Send request
            </Button>
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-sm text-store-text-secondary">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            Requests are free to raise. Approvals create a pickup or a free reprint; nothing is charged on this page.{' '}
            {eligibility && <Badge variant="outline" size="sm">Window: {eligibility.windowDays} days</Badge>}
          </span>
        </p>
      </main>
      <Footer />
    </div>
  );
}
