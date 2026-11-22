'use client';

import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import type { WalletEntryRow, WalletSummary } from '@tuw/heart/modules/fulfillment';
import { Badge, Button, ContentCard, EmptyState, Input, Select, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ToastMessage } from '@/components/providers/ToastProvider';
import { getWalletAction, recordWalletEntryAction } from '@/server/fulfillment-actions';





const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

const KIND_LABEL: Record<string, string> = {
  recharge: 'Top-up', order_debit: 'Order charge', cancel_credit: 'Cancellation credit',
  claim_credit: 'Claim credit', cod_remittance: 'COD transfer in', withdrawal: 'Withdrawal to bank', adjustment: 'Correction',
};

export default function WalletPanel({ onToast, canManage }: { onToast: (t: Omit<ToastMessage, 'id'>) => void; canManage: boolean }) {
  const [summaries, setSummaries] = useState<WalletSummary[]>([]);
  const [ledger, setLedger] = useState<WalletEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [kind, setKind] = useState<'recharge' | 'withdrawal' | 'adjustment'>('recharge');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await getWalletAction({});
    setLoading(false);
    if (result.ok) {
      setSummaries(result.data.summaries);
      setLedger(result.data.ledger);
    } else {
      onToast({ type: 'warning', title: 'Could Not Load The Wallet', description: result.error.message });
    }
  };
  useEffect(() => { void load();  }, []);

  const summary = summaries[0] ?? null;

  const record = async () => {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      onToast({ type: 'warning', title: 'Amount Required', description: 'Enter the rupee amount of this entry.' });
      return;
    }
    if (note.trim().length < 3) {
      onToast({ type: 'warning', title: 'Note Required', description: 'Say what this entry is for — the ledger is read months later.' });
      return;
    }
    setBusy(true);
    const result = await recordWalletEntryAction({
      kind, amountPaise: Math.round(rupees * 100), note: note.trim(),
      externalRef: externalRef.trim() || undefined, direction: kind === 'adjustment' ? direction : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      onToast({ type: 'warning', title: 'Entry Not Recorded', description: result.error.message });
      return;
    }
    onToast({ type: 'success', title: 'Wallet Updated', description: `${result.data.providerName} balance is now ${inr(result.data.balancePaise)}.` });
    setAmount(''); setNote(''); setExternalRef('');
    await load();
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <StatCard label="Prepaid balance" value={summary ? inr(summary.balancePaise) : '—'} subtitle={summary ? summary.providerName : 'No partner with a wallet'} trendType={summary && summary.balancePaise < 0 ? 'down' : 'neutral'} hoverable />
        <StatCard label="Charged (30 days)" value={summary ? inr(summary.debited30dPaise) : '—'} subtitle="Product, print and shipping" trendType="neutral" hoverable />
        <StatCard label="Credited (30 days)" value={summary ? inr(summary.credited30dPaise) : '—'} subtitle="Top-ups, cancels, claims, COD" trendType="up" hoverable />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
        <ContentCard>
          {ledger.length === 0 ? (
            <EmptyState icon={<Wallet size={22} />} title={loading ? 'Loading…' : 'No entries yet'} description="Charges appear here as orders are printed; top-ups are recorded by hand." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Balance after</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div style={{ fontWeight: 600 }}>{KIND_LABEL[entry.kind] ?? entry.kind}</div>
                      <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)' }}>{when(entry.createdAt)}</div>
                    </TableCell>
                    <TableCell>{entry.orderNumber ?? '—'}</TableCell>
                    <TableCell style={{ maxWidth: 220, fontSize: 12 }}>{entry.note ?? entry.externalRef ?? '—'}</TableCell>
                    <TableCell>{entry.balanceAfterPaise === null ? '—' : inr(entry.balanceAfterPaise)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.direction === 'credit' ? 'success' : 'neutral'}>
                        {entry.direction === 'credit' ? '+' : '−'}{inr(entry.amountPaise)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ContentCard>

        <ContentCard>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Record a wallet entry</h3>
          <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', margin: '0 0 14px' }}>
            Use this after topping the provider up outside the app, taking money back, or fixing a charge the partner got wrong.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <Select
              label="Entry" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
              options={[{ value: 'recharge', label: 'Top-up (money in)' }, { value: 'withdrawal', label: 'Withdrawal (money back)' }, { value: 'adjustment', label: 'Correction' }]}
            />
            {kind === 'adjustment' ? (
              <Select label="Direction" value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} options={[{ value: 'credit', label: 'Add to the balance' }, { value: 'debit', label: 'Take from the balance' }]} />
            ) : null}
            <Input label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000.00" />
            <Input label="Provider transaction id (optional)" value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="UTR / receipt no." />
            <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank top-up UTR 8891…" />
            <Button variant="primary" size="md" disabled={busy || !canManage} onClick={() => void record()}>
              <span>{busy ? 'Saving…' : 'Record entry'}</span>
            </Button>
            <p style={{ fontSize: 11, color: 'var(--tuw-text-secondary)', margin: 0 }}>
              The ledger is append-only: corrections are new rows, never edits. While Qikink runs as the simulator no real money moves.
            </p>
          </div>
        </ContentCard>
      </div>
    </>
  );
}
