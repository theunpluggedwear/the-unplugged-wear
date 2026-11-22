'use client';

import React, { useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Badge, Button, ContentCard, Input, PageHeader, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { AbandonedCartRow } from '@tuw/heart/modules/analytics';
import { remindAbandonedAction } from '@/server/analytics-actions';
import { MONO_ID_STYLE } from '@/lib/format';

export default function AbandonedLiveView({ initial }: { initial: AbandonedCartRow[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = rows.filter((r) => {
    const q = query.toLowerCase();
    return r.id.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q);
  });
  const detected = rows.filter((r) => r.status === 'detected');
  const recoverable = detected.reduce((sum, r) => sum + r.cartTotal, 0);
  const converted = rows.filter((r) => r.status === 'converted' || r.status === 'recovered').length;

  async function remind(id: string) {
    setBusyId(id);
    setNotice(null);
    const result = await remindAbandonedAction({ id });
    setBusyId(null);
    if (!result.ok) { setNotice(result.error.message); return; }
    if (result.data.row) setRows((list) => list.map((r) => (r.id === id ? result.data.row! : r)));
    setNotice('Reminder queued and marked sent.');
  }

  return (
    <DashboardShell pageTitle="Abandoned" activeNav="abandoned">
      <PageHeader title="Abandoned Carts" subtitle="Live recovery inbox from idle carts." />

      {notice && <p role="status" style={{ color: 'var(--tuw-text-info)', fontSize: 13 }}>{notice}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="At-risk carts" value={detected.length} subtitle="Awaiting reminder" trendType="neutral" />
        <StatCard label="Recoverable value" value={`₹${recoverable.toLocaleString('en-IN')}`} subtitle="Detected carts only" trendType="up" />
        <StatCard label="Recovery rate" value={`${rows.length ? Math.round((converted / rows.length) * 100) : 0}%`} subtitle="Converted share" trendType="up" />
      </div>

      <ContentCard>
        <div style={{ maxWidth: 320, marginBottom: 16 }}>
          <Input aria-label="Search carts" placeholder="Search cart or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Table>
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>Cart</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow hoverable={false}><TableCell colSpan={6}>No abandoned carts recorded yet.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} hoverable={false}>
                <TableCell style={MONO_ID_STYLE}>{r.cartId}</TableCell>
                <TableCell>{r.email ?? 'Guest — no email captured'}</TableCell>
                <TableCell>{r.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</TableCell>
                <TableCell className="tuw-tabular-nums">₹{r.cartTotal.toLocaleString('en-IN')}</TableCell>
                <TableCell><Badge variant={r.status === 'detected' ? 'danger' : r.status === 'reminded' ? 'warning' : 'success'}>{r.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="secondary" size="sm" disabled={r.status !== 'detected' || busyId === r.id} onClick={() => void remind(r.id)}>
                    {r.status === 'detected' ? 'Remind' : 'Sent'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentCard>
    </DashboardShell>
  );
}
