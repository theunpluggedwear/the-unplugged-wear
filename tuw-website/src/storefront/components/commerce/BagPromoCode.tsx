'use client';

import React, { useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { formatRupees } from '@storefront/lib/format';
import { useStore } from '@storefront/mocks/store';

/**
 * Promo code for the bag: a quiet "Have a promo code?" link that opens a
 * field. Apply shows progress; a refusal is explained under the field and the
 * typed code is kept; an accepted code becomes a chip with Remove.
 */
export default function BagPromoCode() {
  const { promoCode, discountAmount, applyPromoCode, removePromoCode } = useStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  if (promoCode) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm" role="status">
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-store-gold/50 bg-store-gold/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-store-charcoal">
            <Check size={12} aria-hidden="true" />
            {promoCode}
          </span>
          <span className="text-xs text-store-muted truncate">
            {discountAmount > 0 ? `−${formatRupees(discountAmount)} applied` : 'Applies once your bag meets its minimum'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            removePromoCode();
            setCode('');
            setOpen(false);
          }}
          className="shrink-0 text-xs font-medium text-store-muted hover:text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1"
        >
          Remove<span className="sr-only"> promo code {promoCode}</span>
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="text-xs font-medium text-store-charcoal underline underline-offset-4 decoration-store-card-border hover:decoration-store-charcoal cursor-pointer py-1"
      >
        Have a promo code?
      </button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter a code first.');
      inputRef.current?.focus();
      return;
    }
    setChecking(true);
    setError(null);
    const ok = await applyPromoCode(trimmed, { quiet: true, onError: setError });
    setChecking(false);
    if (ok) setCode('');
    else inputRef.current?.focus(); // keep what they typed so they can correct it
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="text-xs font-medium text-store-charcoal">
          Promo code
        </label>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          aria-label="Close promo code"
          className="p-1 -m-1 rounded-full text-store-muted hover:text-store-charcoal cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={fieldId}
          // Mounted only after the shopper asks for the field, so focusing it is expected.
          autoFocus
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`flex-1 min-w-0 h-10 px-3 rounded-lg border bg-white text-sm tracking-wide text-store-charcoal outline-none transition-colors focus:border-store-charcoal ${error ? 'border-store-terracotta' : 'border-store-card-border'}`}
        />
        <button
          type="submit"
          disabled={checking}
          className="shrink-0 h-10 min-w-20 px-4 rounded-lg border border-store-charcoal text-xs font-semibold uppercase tracking-wider text-store-charcoal hover:bg-store-charcoal hover:text-white transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="sr-only">Checking code</span>
            </>
          ) : (
            'Apply'
          )}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-store-terracotta">
          {error}
        </p>
      )}
    </form>
  );
}
