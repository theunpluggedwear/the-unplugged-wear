'use client';

import React, { useState } from 'react';
import { ArrowRight, Banknote, CreditCard, Lock, QrCode, RefreshCw } from 'lucide-react';
import { formatRupees } from '@storefront/lib/format';

type Method = 'Card' | 'UPI' | 'COD (Demo)';

export interface LivePaymentPanelProps {
  totalAmount: number;
  placing: boolean;
  /** Same handler as the demo panel: online methods open the Razorpay window. */
  onPay: (method: Method) => void;
  onCancel: () => void;
}

const METHODS: { id: Method; label: string; hint: string; Icon: typeof CreditCard }[] = [
  { id: 'Card', label: 'Card', hint: 'Credit or debit card, entered in the secure Razorpay window.', Icon: CreditCard },
  { id: 'UPI', label: 'UPI / NetBanking', hint: 'Pay with any UPI app or your bank in the secure Razorpay window.', Icon: QrCode },
  { id: 'COD (Demo)', label: 'Pay on Delivery', hint: 'Pay when your order arrives. Nothing is charged now.', Icon: Banknote },
];

/** Payment step when a real gateway is active: no simulated card fields. */
export default function LivePaymentPanel({ totalAmount, placing, onPay, onCancel }: LivePaymentPanelProps) {
  const [method, setMethod] = useState<Method>('Card');
  const online = method !== 'COD (Demo)';

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="sr-only">Payment method</legend>
        {METHODS.map(({ id, label, hint, Icon }) => (
          <label
            key={id}
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-store-charcoal ${
              method === id ? 'border-store-charcoal bg-store-cream' : 'border-store-card-border hover:border-store-charcoal/50'
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value={id}
              checked={method === id}
              onChange={() => setMethod(id)}
              className="mt-1 accent-store-charcoal"
            />
            <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-store-charcoal" />
            <span>
              <span className="block text-sm font-semibold text-store-charcoal">{label}</span>
              <span className="block text-xs text-store-text-secondary">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {online && (
        <p className="flex items-center gap-2 text-xs text-store-text-secondary">
          <Lock size={14} aria-hidden="true" />
          Payments are processed securely by Razorpay. We never see your card details.
        </p>
      )}

      <div className="pt-2 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs uppercase font-semibold tracking-wider text-store-muted hover:text-store-charcoal transition-colors cursor-pointer"
        >
          Back to Details
        </button>

        <button
          type="button"
          disabled={placing}
          onClick={() => onPay(method)}
          className="px-6 py-3.5 rounded-full bg-[#111111] hover:bg-store-charcoal text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          {placing ? (
            <>
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              <span>Processing…</span>
            </>
          ) : (
            <>
              <span>{online ? 'Pay' : 'Place Order'} ({formatRupees(totalAmount)})</span>
              <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
