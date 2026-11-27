'use client';

import React, { useState } from 'react';
import { Badge, Button, ContentCard, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui';
import type { SupportTicketRow } from '@tuw/heart/modules/support';
import { replyTicketAction, setTicketStatusAction } from '@/server/support-actions';

export default function SupportLiveView({ initial, selectedId: requestedId }: { initial: SupportTicketRow[]; selectedId: string | null }) {
  const [tickets, setTickets] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.some((ticket) => ticket.id === requestedId) ? requestedId : (initial[0]?.id ?? null));
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  function selectTicket(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setReply('');
    setNotice(null);
  }

  async function sendReply() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const result = await replyTicketAction({ id: selected.id, body: reply });
      if (!result.ok) { setNotice(result.error.message); return; }
      setReply('');
      setNotice('Reply saved to the thread.');
      setTickets((list) => list.map((t) => t.id === selected.id ? { ...t, status: 'pending' } : t));
    } catch {
      setNotice('The reply could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: SupportTicketRow['status']) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const result = await setTicketStatusAction({ id: selected.id, status });
      if (!result.ok) { setNotice(result.error.message); return; }
      setTickets((list) => list.map((t) => t.id === selected.id ? { ...t, status } : t));
      setNotice(`Status set to ${status}.`);
    } catch {
      setNotice('The status could not be changed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Support Inbox" subtitle="Live support tickets from the database." />

      {notice && <p role="status" style={{ color: 'var(--tuw-text-info)', fontSize: 13 }}>{notice}</p>}

      <ContentCard padding="0px">
        <Table>
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>Subject</TableHead><TableHead>Customer</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow hoverable={false}><TableCell colSpan={5}>No support tickets yet.</TableCell></TableRow>
            ) : tickets.map((t) => (
              <TableRow key={t.id} hoverable={false}>
                <TableCell>{t.subject}</TableCell>
                <TableCell>{t.customerName}{t.customerEmail ? ` · ${t.customerEmail}` : ''}</TableCell>
                <TableCell>
                  <Badge variant={t.source === 'contact_form' ? 'info' : 'neutral'} size="sm">
                    {t.source === 'contact_form' ? 'Contact form' : t.source}
                  </Badge>
                </TableCell>
                <TableCell><Badge variant={t.status === 'resolved' ? 'success' : t.status === 'pending' ? 'warning' : 'info'}>{t.status}</Badge></TableCell>
                <TableCell><Button variant="secondary" size="sm" onClick={() => selectTicket(t.id)}>Open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentCard>

      {selected && (
        <ContentCard>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>{selected.subject}</h2>
          <div className="space-y-2" style={{ fontSize: 14 }}>
            {selected.messages.length === 0 ? <p style={{ color: 'var(--tuw-text-secondary)' }}>No messages on this thread yet.</p> : selected.messages.map((m) => (
              <div key={m.id} style={{ padding: 12, border: '1px solid var(--tuw-border-subtle)', borderRadius: 8 }}>
                <strong>{m.sender === 'staff' ? 'Staff' : selected.customerName}</strong>
                <p style={{ marginTop: 4 }}>{m.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Textarea key={selected.id} label="Reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <Button variant="primary" size="md" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>Send reply</Button>
              <Button variant="secondary" size="md" disabled={busy} onClick={() => void changeStatus('resolved')}>Resolve</Button>
            </div>
          </div>
        </ContentCard>
      )}
    </>
  );
}
