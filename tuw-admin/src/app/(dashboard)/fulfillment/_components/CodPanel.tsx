'use client';

import React, { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import type { RemittanceRow } from '@tuw/heart/modules/fulfillment';
import { Badge, Button, ContentCard, EmptyState, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ToastMessage } from '@/mocks/state';
import { getCodAction, recordRemittanceAction } from '@/server/fulfillment-actions';

// Cash-on-delivery money (DOC/backend/16 §5). The courier collects cash, the
// partner pays it back as one transfer per cycle; every delivered COD parcel
// points at the transfer that settled it, so chasing a missing payment is a
// filter, not an investigation.

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

interface Pending { id: string; orderNumber: string; codPaise: number; deliveredAt: string | null }

export default function CodPanel({ onToast, canManage }: { onToast: (t: Omit<ToastMessage, 'id'>) => void; canManage: boolean }) {
  const [remittances, setRemittances] = useState<RemittanceRow[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);

  const [transferRef, setTransferRef] = useState('');
  const [amount, setAmount] = useState('');
  const [fees, setFees] = useState('');
  const [remittedTo, setRemittedTo] = useState<'wallet' | 'bank'>('bank');
  const [remittedAt, setRemittedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await getCodAction({});
    setLoading(false);
    if (result.ok) {
      setRemittances(result.data.remittances);
      setPending(result.data.pending);
    } else {
      onToast({ type: 'warning', title: 'Could Not Load COD', description: result.error.message });
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const pendingTotal = pending.reduce((sum, p) => sum + p.codPaise, 0);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const record = async () => {
    const rupees = Number(amount);
    const fee = fees.trim() ? Number(fees) : 0;
    if (!transferRef.trim() || transferRef.trim().length < 3) {
      onToast({ type: 'warning', title: 'Transfer Id Required', description: 'Use the partner’s transfer id / UTR — it is the duplicate guard.' });
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      onToast({ type: 'warning', title: 'Amount Required', description: 'Enter the amount the partner transferred.' });
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      onToast({ type: 'warning', title: 'Check The Fee', description: 'The fee cannot be negative.' });
      return;
    }
    setBusy(true);
    const result = await recordRemittanceAction({
      transferRef: transferRef.trim(), amountPaise: Math.round(rupees * 100), feesPaise: Math.round(fee * 100),
      remittedTo, remittedAt: new Date(`${remittedAt}T12:00:00+05:30`).toISOString(),
      fulfillmentIds: selected,
    });
    setBusy(false);
    if (!result.ok) {
      onToast({ type: 'warning', title: 'Transfer Not Recorded', description: result.error.message });
      return;
    }
    onToast({
      type: 'success', title: 'COD Transfer Recorded',
      description: `${result.data.parcels} parcel${result.data.parcels === 1 ? '' : 's'} settled${result.data.unallocatedPaise ? ` · ${inr(result.data.unallocatedPaise)} left unallocated` : ''}.`,
    });
    setTransferRef(''); setAmount(''); setFees(''); setSelected([]);
    await load();
  };

  return (
    <>
      <ContentCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Cash to collect</h3>
            <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', margin: '2px 0 0' }}>
              Delivered COD parcels the partner has not paid back yet · {inr(pendingTotal)} across {pending.length} parcel{pending.length === 1 ? '' : 's'}.
            </p>
          </div>
          {selected.length ? <Badge variant="info">{selected.length} selected · {inr(pending.filter((p) => selected.includes(p.id)).reduce((s, p) => s + p.codPaise, 0))}</Badge> : null}
        </div>
        {pending.length === 0 ? (
          <EmptyState icon={<Banknote size={22} />} title={loading ? 'Loading…' : 'Everything is settled'} description="No delivered cash-on-delivery parcel is waiting for a transfer." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((parcel) => (
                <TableRow key={parcel.id}>
                  <TableCell>{parcel.orderNumber}</TableCell>
                  <TableCell>{when(parcel.deliveredAt)}</TableCell>
                  <TableCell>{inr(parcel.codPaise)}</TableCell>
                  <TableCell>
                    <Button variant={selected.includes(parcel.id) ? 'primary' : 'secondary'} size="sm" onClick={() => toggle(parcel.id)}>
                      <span>{selected.includes(parcel.id) ? 'Selected' : 'Select'}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ContentCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start', marginTop: 16 }}>
        <ContentCard>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Recorded transfers</h3>
          {remittances.length === 0 ? (
            <EmptyState icon={<Banknote size={22} />} title="No transfer yet" description="The partner pays COD back in cycles; record each transfer here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer</TableHead>
                  <TableHead>Paid to</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Parcels</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remittances.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell style={{ fontWeight: 600 }}>{row.transferRef}</TableCell>
                    <TableCell><Badge variant={row.remittedTo === 'wallet' ? 'info' : 'neutral'}>{row.remittedTo}</Badge></TableCell>
                    <TableCell>{when(row.remittedAt)}</TableCell>
                    <TableCell>{inr(row.feesPaise)}</TableCell>
                    <TableCell>{row.parcels}</TableCell>
                    <TableCell>
                      {inr(row.amountPaise)}
                      {row.unallocatedPaise ? (
                        <div style={{ fontSize: 11, color: 'var(--tuw-warning-700, #B54708)' }}>{inr(row.unallocatedPaise)} unallocated</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ContentCard>

        <ContentCard>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Record a transfer</h3>
          <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', margin: '0 0 14px' }}>
            Leave parcels unselected and the oldest unsettled ones are matched up to the amount.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <Input label="Transfer id / UTR" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="QK-COD-…" />
            <Input label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3899.00" />
            <Input label="Partner fee (₹)" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" />
            <Select label="Paid into" value={remittedTo} onChange={(e) => setRemittedTo(e.target.value as typeof remittedTo)} options={[{ value: 'bank', label: 'Bank account' }, { value: 'wallet', label: 'Prepaid wallet (Qikink)' }]} />
            <Input label="Transfer date" type="date" value={remittedAt} onChange={(e) => setRemittedAt(e.target.value)} />
            <Button variant="primary" size="md" disabled={busy || !canManage} onClick={() => void record()}>
              <span>{busy ? 'Saving…' : 'Record transfer'}</span>
            </Button>
            <p style={{ fontSize: 11, color: 'var(--tuw-text-secondary)', margin: 0 }}>
              A transfer id can only be recorded once. Wallet transfers also credit the prepaid balance.
            </p>
          </div>
        </ContentCard>
      </div>
    </>
  );
}
