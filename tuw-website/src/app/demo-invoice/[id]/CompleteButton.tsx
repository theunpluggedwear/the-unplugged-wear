'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeQaDemoPaymentAction } from '@/server/qa-demo-actions';

export default function CompleteButton({ documentId, orderNumber }: { documentId: string; orderNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false);

  const complete = async () => {
    if (busy || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await completeQaDemoPaymentAction({ documentId });
      if (!result.ok) throw new Error(result.error.message);
      router.push(`/checkout/success?order=${encodeURIComponent(result.data.orderNumber || orderNumber)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the demo payment.');
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void complete()}
        disabled={busy}
        className="w-full inline-flex items-center justify-center px-6 py-4 rounded-full bg-store-action-primary text-white text-xs font-semibold uppercase tracking-wider hover:bg-store-action-hover disabled:opacity-50"
      >
        {busy ? 'Completing…' : 'Complete demo payment'}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
