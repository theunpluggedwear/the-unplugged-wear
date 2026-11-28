'use client';

import { useState } from 'react';
import { issueGiftCardAction } from '@/server/gift-card-actions';

type Row = {
  id: string;
  codeLast4: string;
  initialValue: number;
  balance: number;
  status: string;
  expiresAt: string | null;
  recipientEmail: string | null;
  createdAt: string;
};

export default function GiftCardsView({ initial, perms }: { initial: { rows: Row[]; total: number }; perms: string[] }) {
  const [rows, setRows] = useState(initial.rows);
  const [amount, setAmount] = useState('1000');
  const [recipient, setRecipient] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await issueGiftCardAction({ amountPaise: Math.round(Number(amount) * 100), recipientEmail: recipient || undefined });
      if (!res.ok) throw new Error(res.error.message);
      setCode(res.data.code);
      setRows((r) => [{ id: res.data.id, codeLast4: res.data.last4, initialValue: res.data.amountPaise, balance: res.data.amountPaise, status: 'active', expiresAt: res.data.expiresAt, recipientEmail: recipient || null, createdAt: new Date().toISOString() }, ...r]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Gift cards</h1>
      <div className="flex gap-2 items-end">
        <label className="text-sm">Amount (INR)
          <input className="ml-2 border rounded px-2 py-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-sm">Recipient email
          <input className="ml-2 border rounded px-2 py-1" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </label>
        <button className="px-3 py-1 rounded bg-black text-white disabled:opacity-50" disabled={busy || !perms.includes('giftcard.manage')} onClick={issue}>
          Issue card
        </button>
      </div>
      {code && <div className="p-3 rounded bg-emerald-50 text-emerald-900">Issued code (shown once): <strong>{code}</strong></div>}
      <table className="w-full text-sm border">
        <thead><tr><th className="text-left p-2">Last4</th><th className="text-left p-2">Balance</th><th className="text-left p-2">Status</th><th className="text-left p-2">Expires</th><th className="text-left p-2">Recipient</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">••••{r.codeLast4}</td>
              <td className="p-2">{(r.balance / 100).toFixed(2)}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—'}</td>
              <td className="p-2">{r.recipientEmail ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}