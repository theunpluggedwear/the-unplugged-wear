'use client';

import { useState } from 'react';
import { checkGiftCardBalanceAction } from '@/server/gift-card-actions';

export default function GiftCardBalancePage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ last4: string; balancePaise: number; status: string; expiresAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await checkGiftCardBalanceAction({ code });
      if (!r.ok) setError(r.error.message);
      else if (!r.data) setError('We could not find that gift card.');
      else setResult(r.data);
    } catch {
      setError('We could not check that card right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Check gift card balance</h1>
      <input className="w-full border rounded px-3 py-2" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter your gift card code" />
      <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={busy || !code.trim()} onClick={check}>Check balance</button>
      {error && <p className="text-red-600">{error}</p>}
      {result && (
        <div className="border rounded p-4 space-y-1">
          <div>Card ending ••••{result.last4}</div>
          <div>Status: {result.status}</div>
          <div>Balance: ₹{(result.balancePaise / 100).toFixed(2)}</div>
          <div>Expires: {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : '—'}</div>
        </div>
      )}
    </main>
  );
}