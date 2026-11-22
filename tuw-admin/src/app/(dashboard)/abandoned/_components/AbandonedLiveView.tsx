'use client';

import React, { useState } from 'react';
import { Badge, Button, ContentCard, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
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
    <ContentCard>
      {notice && <p role="status" style={{ color: 'var(--tuw-text-info)', fontSize: 13, marginBottom: 12 }}>{notice}</p>}
      <div style={{ maxWidth: 320, marginBottom: 16 }}>
        <Input aria-label="Search carts" placeholder="Search cart or email" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Table>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead>Cart</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead>
            <TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
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
  );
}
