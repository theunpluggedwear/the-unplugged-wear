'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@storefront/mocks/store';
import { formatRupees } from '@storefront/lib/format';
import type { Product } from '@storefront/lib/types';

type Denomination = { label: string; paise: number };

export default function GiftCardPurchase({ product, validityMonths }: { product: Product; validityMonths: number }) {
  const router = useRouter();
  const { addToCart } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const denominations = useMemo<Denomination[]>(() => {
    const fromSizes = product.sizes
      .map((s) => ({ label: s.size, paise: s.priceMinorINR ?? (s.priceINR !== undefined ? Math.round(s.priceINR * 100) : product.priceMinorINR ?? 0) }))
      .filter((d) => d.paise > 0);
    if (fromSizes.length) return fromSizes;
    return [{ label: 'Gift card', paise: product.priceMinorINR ?? Math.round(product.priceINR * 100) }];
  }, [product]);
  const [selected, setSelected] = useState(0);
  const chosen = denominations[selected] ?? denominations[0]!;

  const expiry = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + validityMonths);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [validityMonths]);

  function add() {
    setError(null);
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the recipient email so we can deliver the code.');
      return;
    }
    addToCart({
      productId: product.productId || product.id,
      title: `${product.title} — ${chosen.label}`,
      color: 'Standard',
      size: product.sizes.length ? chosen.label : 'One size',
      priceINR: chosen.paise / 100,
      priceMinorINR: chosen.paise,
      quantity: qty,
      image: product.images[0]?.url ?? '',
      giftRecipientName: name.trim() || undefined,
      giftRecipientEmail: email.trim().toLowerCase(),
      giftMessage: message.trim() || undefined,
    });
    router.push('/cart');
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        {product.images[0] && (
          <img src={product.images[0].url} alt={product.title} className="w-full rounded-2xl object-cover" />
        )}
      </div>
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-widest text-store-muted">Digital gift card</p>
        <h1 className="tuw-h1 text-store-charcoal">{product.title}</h1>
        <p className="text-sm text-store-text-secondary">
          A thoughtful gift that never gets printed or shipped. The recipient gets a code by email, ready to use at checkout.
        </p>

        <div>
          <p className="text-sm font-medium mb-2">Choose an amount</p>
          <div className="flex flex-wrap gap-2">
            {denominations.map((d, i) => (
              <button
                key={d.label}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                  i === selected ? 'border-store-charcoal bg-store-charcoal text-white' : 'border-store-card-border hover:border-store-charcoal'
                }`}
              >
                {formatRupees(d.paise / 100)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Recipient name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-store-card-border px-3 py-2" />
          </label>
          <label className="text-sm">Recipient email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-store-card-border px-3 py-2" />
          </label>
        </div>

        <label className="block text-sm">Personal message (optional)
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-store-card-border px-3 py-2" />
        </label>

        <label className="block text-sm">Quantity
          <input type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="mt-1 w-24 rounded-lg border border-store-card-border px-3 py-2" />
        </label>

        <div className="rounded-xl bg-store-cream p-4 text-sm text-store-text-secondary">
          <p>Valid for {validityMonths} months — until <strong>{expiry}</strong>.</p>
          <p className="mt-1">Any remaining balance is not refundable after expiry. Gift cards are paid for online; cash on delivery is not available.</p>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button type="button" onClick={add} className="w-full rounded-full bg-store-charcoal px-6 py-3 text-white font-semibold hover:bg-black transition-colors">
          Add gift card to bag — {formatRupees((chosen.paise * qty) / 100)}
        </button>

        <p className="text-xs text-store-muted">
          Already have a card? <a href="/gift-cards/balance" className="underline">Check your balance</a>.
        </p>
      </div>
    </div>
  );
}