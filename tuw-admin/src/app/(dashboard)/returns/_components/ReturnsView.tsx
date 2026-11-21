'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Search, Eye, RotateCcw, PackageCheck, Undo2 } from 'lucide-react';
import type {
  AdminReturnDetail,
  AdminReturnRow,
  AdminReturnStats,
  ReturnStatus,
} from '@tuw/heart/modules/returns';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  StatCard,
  ContentCard,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Drawer,
  Pagination,
  FilterPills,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  PanelLayout,
  DrawerSection,
  ItemsRow,
} from '@/components/ui';
import { useAdminState } from '@/mocks/state';
import {
  getReturnAction,
  listReturnsAction,
  refundReturnAction,
  setReturnItemAction,
  setReturnStatusAction,
} from '@/server/return-actions';

// Exchange and replacement requests (TL-BE-10). The server owns eligibility,
// the follow-up order, stock and refunds; this screen only asks it to act.
// A request is decided once (approve/reject); after that it follows its
// pickup → received → inspected → completed path with a disposition per line.

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'sub-' + String(p) });

type ListResult = { rows: AdminReturnRow[]; total: number; stats: AdminReturnStats };
type StatusFilter = ReturnStatus | 'all';
type TypeFilter = 'exchange' | 'replacement' | 'all';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

const STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  pickup_scheduled: 'Pickup scheduled',
  in_transit: 'In transit',
  received: 'Received',
  inspected: 'Inspected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};
const STATUS_BADGE: Record<ReturnStatus, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'danger',
  pickup_scheduled: 'neutral',
  in_transit: 'neutral',
  received: 'warning',
  inspected: 'warning',
  completed: 'success',
  cancelled: 'neutral',
  disputed: 'danger',
};
const TYPE_LABEL: Record<'exchange' | 'replacement', string> = { exchange: 'Exchange', replacement: 'Replacement' };
const REASON_LABEL: Record<string, string> = {
  size_fit: 'Size or fit', wrong_variant: 'Wrong variant chosen', damaged: 'Damaged on arrival',
  misprint: 'Print defect', wrong_item: 'Wrong item received', quality: 'Print quality',
};
const DISPOSITION_LABEL: Record<string, string> = {
  pending: 'Waiting at warehouse', restock: 'Back in stock', scrap: 'Scrapped', return_to_customer: 'Sent back to customer',
  exchange: 'Replaced (exchange)', replacement: 'Reprinted',
};
/** What each move's button says. */
const MOVE_LABEL: Record<ReturnStatus, string> = {
  requested: 'Reopen',
  approved: 'Approve',
  rejected: 'Reject',
  pickup_scheduled: 'Pickup scheduled',
  in_transit: 'Mark in transit',
  received: 'Mark received',
  inspected: 'Mark inspected',
  completed: 'Complete',
  cancelled: 'Cancel request',
  disputed: 'Mark disputed',
};

export default function ReturnsView({ initial, perms, openRma }: { initial: ListResult; perms: string[]; openRma?: string }) {
  const { showToast } = useAdminState();
  const canManage = perms.includes('return.manage');

  const [list, setList] = useState<ListResult>(initial);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<StatusFilter>('all');
  const [typeTab, setTypeTab] = useState<TypeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [detail, setDetail] = useState<AdminReturnDetail | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'source' | 'upi' | 'bank_transfer'>('source');
  const [refundDestination, setRefundDestination] = useState('');
  // One key per staff intent, so a retried refund cannot pay twice.
  const refundKey = useRef<string | null>(null);

  // A slower, older list answer never overwrites a newer one.
  const request = useRef(0);
  const openingInFlight = useRef(false);
  const openRequest = useRef(0);
  const load = async (over: Partial<{ q: string; status: StatusFilter; type: TypeFilter; page: number; perPage: number }> = {}) => {
    const mine = ++request.current;
    setLoading(true);
    const result = await listReturnsAction({ q: searchTerm || undefined, status: statusTab, type: typeTab, page: currentPage, perPage: pageSize, ...over });
    if (mine !== request.current) return;
    setLoading(false);
    if (result.ok) setList(result.data);
    else showToast({ type: 'warning', title: 'Could Not Load Returns', description: result.error.message });
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusTab, typeTab, currentPage, pageSize]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusTab, typeTab]);

  const openReturn = async (row: AdminReturnRow) => {
    if (openingInFlight.current) return;
    openingInFlight.current = true;
    const mine = ++openRequest.current;
    setOpeningId(row.id);
    setNote('');
    setRejecting(false);
    setRejectionReason('');
    setRefundOpen(false);
    try {
      const result = await getReturnAction({ returnId: row.id });
      if (mine !== openRequest.current) return;
      if (result.ok) setDetail(result.data);
      else showToast({ type: 'warning', title: 'Could Not Open Request', description: result.error.message });
    } catch (error) {
      showToast({ type: 'warning', title: 'Could Not Open Request', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      openingInFlight.current = false;
      if (mine === openRequest.current) setOpeningId(null);
    }
  };

  // Notification links arrive as /returns?open=RMA-XXXX; the list may not hold it.
  const linkOpened = useRef(false);
  useEffect(() => {
    if (!openRma || linkOpened.current) return;
    linkOpened.current = true;
    const inList = list.rows.find((r) => r.rmaNumber.toUpperCase() === openRma);
    if (inList) { void openReturn(inList); return; }
    void (async () => {
      const result = await listReturnsAction({ q: openRma, status: 'all', type: 'all', page: 1, perPage: 1 });
      if (result.ok && result.data.rows[0]) void openReturn(result.data.rows[0]);
      else showToast({ type: 'warning', title: 'Request Not Found', description: `No request matches ${openRma}.` });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRma]);

  const refreshDetail = async (id: string) => {
    const result = await getReturnAction({ returnId: id });
    if (result.ok) setDetail(result.data);
  };

  const move = async (to: ReturnStatus) => {
    if (!detail) return;
    if (to === 'rejected' && rejectionReason.trim().length < 3) {
      showToast({ type: 'warning', title: 'Reason Required', description: 'The customer reads why the request is refused.' });
      return;
    }
    setBusy(true);
    try {
      const result = await setReturnStatusAction({
        returnId: detail.id, to, note: note || undefined,
        rejectionReason: to === 'rejected' ? rejectionReason : undefined,
      });
      if (!result.ok) {
        showToast({ type: 'warning', title: 'Could Not Update Request', description: result.error.message });
        return;
      }
      const followUp = result.data.replacementOrderNumber;
      showToast({
        type: 'success',
        title: `Marked ${STATUS_LABEL[to].toLowerCase()}`,
        description: to === 'approved'
          ? followUp
            ? detail.type === 'exchange'
              ? `${followUp} created — ${detail.duePaise > 0 ? `the customer pays ${rupees(detail.duePaise)} difference` : 'no difference to collect'} (demo pay link).`
              : `${followUp} created as a free reprint.`
            : 'Request approved.'
          : undefined,
      });
      setRejecting(false);
      setRejectionReason('');
      setNote('');
      await Promise.all([refreshDetail(detail.id), load()]);
    } catch (error) {
      showToast({ type: 'warning', title: 'Could Not Update Request', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  const setDisposition = async (itemId: string, disposition: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await setReturnItemAction({ returnId: detail.id, itemId, disposition: disposition as never });
      if (!result.ok) {
        showToast({ type: 'warning', title: 'Could Not Set Disposition', description: result.error.message });
        return;
      }
      showToast({ type: 'success', title: 'Disposition Saved', description: disposition === 'restock' ? 'Stock added back and a movement recorded.' : DISPOSITION_LABEL[disposition] });
      await Promise.all([refreshDetail(detail.id), load()]);
    } catch (error) {
      showToast({ type: 'warning', title: 'Could Not Set Disposition', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  const refund = async () => {
    if (!detail) return;
    if (refundMethod !== 'source' && refundDestination.trim().length < 4) {
      showToast({ type: 'warning', title: 'Destination Required', description: 'Enter the UPI id or account this payout goes to.' });
      return;
    }
    refundKey.current ??= crypto.randomUUID();
    setBusy(true);
    try {
      const result = await refundReturnAction({
        returnId: detail.id, method: refundMethod, refundKey: refundKey.current,
        destination: refundMethod === 'source' ? undefined : refundDestination.trim(),
      });
      if (!result.ok) {
        showToast({ type: 'warning', title: 'Refund Failed', description: result.error.message });
        return;
      }
      showToast({ type: 'success', title: 'Refund Issued', description: `${result.data.refundId.slice(0, 8)}… recorded on the demo gateway.` });
      refundKey.current = null;
      setRefundOpen(false);
      setRefundDestination('');
      await Promise.all([refreshDetail(detail.id), load()]);
    } catch (error) {
      showToast({ type: 'warning', title: 'Refund Failed', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!list.rows.length) {
      showToast({ type: 'warning', title: 'Nothing to Export', description: 'No requests match these filters.' });
      return;
    }
    const head = ['RMA', 'Order', 'Customer', 'Email', 'Type', 'Status', 'Items', 'Difference (INR)', 'Due (INR)', 'Created'];
    const body = list.rows.map((r) => [
      r.rmaNumber, r.orderNumber, r.customerName, r.customerEmail, r.type, r.status,
      String(r.itemCount), (r.priceDifferencePaise / 100).toFixed(2), (r.duePaise / 100).toFixed(2), r.createdAt,
    ]);
    const csv = [head, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const stats = list.stats;
  const totalPages = Math.max(1, Math.ceil(list.total / pageSize));
  const decidable = detail ? detail.allowedNext.filter((s) => s !== 'cancelled') : [];
  const canCancelHere = detail ? detail.allowedNext.includes('cancelled') : false;
  const linesLocked = detail ? ['requested', 'rejected', 'cancelled'].includes(detail.status) : true;

  return (
    <DashboardShell pageTitle="Returns" activeNav="returns">
      <PageHeader
        title="Returns & Exchanges"
        actions={
          <Button variant="secondary" size="md" icon={<Download size={16} />} onClick={exportCsv}>
            <span>Export CSV</span>
          </Button>
        }
      />

      <div className={styles.statGrid}>
        <StatCard label="Awaiting Decision" value={String(stats.requested)} subtitle="Needs an approve or reject" trendType={stats.requested > 0 ? 'down' : 'up'} hoverable />
        <StatCard label="Approved" value={String(stats.approved)} subtitle="Follow-up order created" trendType="neutral" hoverable />
        <StatCard label="In Motion" value={String(stats.inFlight)} subtitle="Pickup, transit, received, inspected" trendType="neutral" hoverable />
        <StatCard label="Completed" value={String(stats.completed)} subtitle={`${stats.rejected} rejected · ${stats.total} all time`} trendType="up" hoverable />
      </div>

      <ContentCard>
        <PanelLayout
          scrollable={false}
          header={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <FilterPills
                  variant="pills"
                  ariaLabel="Return status tabs"
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'requested', label: 'Requested' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                  value={statusTab}
                  onChange={(v) => setStatusTab(v as StatusFilter)}
                />
                <div style={{ maxWidth: 360, width: '100%' }}>
                  <Input placeholder="Search RMA, order #, name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} prefixIcon={<Search size={16} />} aria-label="Search returns" />
                </div>
              </div>
              <FilterPills
                variant="pills"
                ariaLabel="Request type"
                options={[
                  { value: 'all', label: 'Exchanges & replacements' },
                  { value: 'exchange', label: 'Exchanges' },
                  { value: 'replacement', label: 'Replacements' },
                ]}
                value={typeTab}
                onChange={(v) => setTypeTab(v as TypeFilter)}
              />
            </div>
          }
          footer={
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={list.total}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50]}
              onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1); }}
            />
          }
        >
          <Table aria-busy={loading || Boolean(openingId)}>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>RMA</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.length === 0 ? (
                <TableRow hoverable={false}>
                  <TableCell colSpan={9}>
                    <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--tuw-text-secondary, #5D6772)', fontSize: 13 }}>
                      {loading ? 'Loading requests…' : 'No return requests match these filters.'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : list.rows.map((row) => (
                <TableRow key={row.id} onClick={() => void openReturn(row)}>
                  <TableCell><span style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{row.rmaNumber}</span></TableCell>
                  <TableCell>{row.orderNumber}</TableCell>
                  <TableCell>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.customerName}</div>
                    <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>{row.customerEmail}</div>
                  </TableCell>
                  <TableCell>{TYPE_LABEL[row.type]}</TableCell>
                  <TableCell>{row.itemCount}</TableCell>
                  <TableCell>
                    <div className="tuw-tabular-nums">{row.priceDifferencePaise === 0 ? '—' : rupees(row.priceDifferencePaise)}</div>
                    {row.duePaise > 0 && <div style={{ fontSize: 12, color: 'var(--tuw-warning-600, #B45309)' }}>{rupees(row.duePaise)} due</div>}
                  </TableCell>
                  <TableCell><Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge></TableCell>
                  <TableCell><span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>{when(row.createdAt)}</span></TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye size={14} />}
                      disabled={openingId === row.id}
                      onClick={(e) => { e.stopPropagation(); void openReturn(row); }}
                    >
                      {openingId === row.id ? 'Opening…' : 'Review'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelLayout>
      </ContentCard>

      <Drawer
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Return ${detail.rmaNumber}` : 'Return Detail'}
        subtitle={detail ? `${detail.orderNumber} · requested ${when(detail.createdAt)}` : undefined}
        width="560px"
        footer={
          detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {!canManage ? (
                <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', margin: 0 }}>
                  Read-only: approving, restocking and refunding need the return.manage permission.
                </p>
              ) : refundOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Select
                    label="Refund method"
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}
                    options={[
                      { value: 'source', label: 'Original payment method' },
                      { value: 'upi', label: 'UPI transfer' },
                      { value: 'bank_transfer', label: 'Bank transfer' },
                    ]}
                  />
                  {refundMethod !== 'source' && (
                    <Input
                      label={refundMethod === 'upi' ? 'UPI id' : 'Account and IFSC'}
                      placeholder={refundMethod === 'upi' ? 'name@bank' : 'Acct … / IFSC …'}
                      value={refundDestination}
                      onChange={(e) => setRefundDestination(e.target.value)}
                      maxLength={60}
                    />
                  )}
                  <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', margin: 0 }}>
                    Demo gateway — no money moves. Only a masked destination is stored.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => void refund()}>{busy ? 'Refunding…' : 'Issue refund'}</Button>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setRefundOpen(false); refundKey.current = null; }}>Not now</Button>
                  </div>
                </div>
              ) : rejecting ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Textarea
                    label="Why is it refused? (the customer sees this)"
                    placeholder="e.g. Photos show the print is undamaged; outside the 7-day window."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    maxLength={255}
                    rows={3}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button variant="danger" size="sm" disabled={busy || rejectionReason.trim().length < 3} onClick={() => void move('rejected')}>
                      {busy ? 'Rejecting…' : 'Reject request'}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRejecting(false)}>Back</Button>
                  </div>
                </div>
              ) : (
                <>
                  {detail.allowedNext.length > 0 && (
                    <Input label="Note for the history (optional)" placeholder="e.g. Pickup booked with Blue Dart" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canCancelHere && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void move('cancelled')}>Cancel request</Button>
                      )}
                      {detail.allowedNext.includes('rejected') && (
                        <Button variant="secondary" size="sm" disabled={busy} icon={<Undo2 size={14} />} onClick={() => setRejecting(true)}>Reject</Button>
                      )}
                      {!detail.refundId && !linesLocked && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRefundOpen(true)}>Refund instead</Button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {decidable.filter((s) => s !== 'rejected').map((to) => (
                        <Button
                          key={to}
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          icon={to === 'approved' ? <PackageCheck size={14} /> : to === 'completed' ? <RotateCcw size={14} /> : undefined}
                          onClick={() => void move(to)}
                        >
                          {busy ? 'Saving…' : MOVE_LABEL[to]}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {detail.status === 'approved' && detail.duePaise > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', margin: 0 }}>
                      {rupees(detail.duePaise)} difference is due from the customer on {detail.replacementOrderNumber}; the account page collects it (demo checkout).
                    </p>
                  )}
                </>
              )}
            </div>
          )
        }
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)', display: 'block' }}>Status</span>
                <Badge variant={STATUS_BADGE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)', display: 'block' }}>Type</span>
                <Badge variant="info">{TYPE_LABEL[detail.type]}</Badge>
                <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: 4 }}>Resolution: {detail.resolution}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)', display: 'block' }}>Difference</span>
                <span className="tuw-tabular-nums" style={{ fontSize: 14, fontWeight: 600 }}>{detail.priceDifferencePaise === 0 ? 'None' : rupees(detail.priceDifferencePaise)}</span>
                {detail.duePaise > 0 && <div style={{ fontSize: 12, color: 'var(--tuw-warning-600, #B45309)' }}>{rupees(detail.duePaise)} unpaid</div>}
              </div>
              {detail.refundId && (
                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)', display: 'block' }}>Refund</span>
                  <Badge variant="success">Issued</Badge>
                  <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>{detail.refundId.slice(0, 8)}…</div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)' }}>Customer</div>
                <div style={{ fontWeight: 600 }}>{detail.customerName}</div>
                <div style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>{detail.customerEmail || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)' }}>Order</div>
                <div style={{ fontWeight: 600 }}>{detail.orderNumber}</div>
                <div style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>{detail.orderStatus} · delivered {detail.deliveredAt ? when(detail.deliveredAt) : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--tuw-text-secondary, #5D6772)' }}>Pickup</div>
                <div style={{ fontWeight: 600 }}>{detail.carrier || 'Not booked'}</div>
                <div style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>{detail.trackingNumber || '—'}</div>
              </div>
            </div>

            {detail.customerNote && (
              <DrawerSection title="Customer's Note" titleGap={8}>
                <p style={{ fontSize: 13, margin: 0, color: 'var(--tuw-text-primary, #262626)', whiteSpace: 'pre-wrap' }}>{detail.customerNote}</p>
              </DrawerSection>
            )}

            {detail.rejectionReason && (
              <DrawerSection title="Refusal Reason" titleGap={8}>
                <p style={{ fontSize: 13, margin: 0, color: 'var(--tuw-danger-700, #B91C1C)' }}>{detail.rejectionReason}</p>
              </DrawerSection>
            )}

            <DrawerSection title={`Items (${detail.lines.length})`} titleGap={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detail.lines.map((line) => (
                  <ItemsRow
                    key={line.id}
                    left={
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>{line.productName}</div>
                        <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                          {line.variantLabel} · Qty {line.qty} · {REASON_LABEL[line.reasonCode] ?? line.reasonCode}
                        </div>
                        {line.exchangeVariantLabel && (
                          <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>Wants instead: {line.exchangeVariantLabel}</div>
                        )}
                        {line.conditionNote && (
                          <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: 2 }}>“{line.conditionNote}”</div>
                        )}
                      </div>
                    }
                    right={
                      <div style={{ minWidth: 170 }}>
                        {canManage && !linesLocked ? (
                          <Select
                            aria-label={`Disposition for ${line.productName}`}
                            value={line.disposition}
                            disabled={busy}
                            onChange={(e) => void setDisposition(line.id, e.target.value)}
                            options={[
                              { value: 'pending', label: 'Waiting at warehouse' },
                              { value: 'restock', label: 'Restock (adds stock)' },
                              { value: 'scrap', label: 'Scrap' },
                              { value: 'return_to_customer', label: 'Send back to customer' },
                            ]}
                          />
                        ) : (
                          <Badge variant={line.disposition === 'restock' ? 'success' : 'neutral'}>{DISPOSITION_LABEL[line.disposition] ?? line.disposition}</Badge>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </DrawerSection>

            <DrawerSection title={`Evidence (${detail.evidence.length})`} titleGap={12}>
              {detail.evidence.length === 0 ? (
                <p style={{ fontSize: 13, margin: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>No photos attached.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.evidence.map((file) => (
                    <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                      <span>{file.filename ?? 'Photo'}</span>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--tuw-text-secondary, #5D6772)' }} title={file.url}>{file.url}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, margin: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                    Demo uploads: files are recorded as demo:// references until real storage lands (TL-BE-11).
                  </p>
                </div>
              )}
            </DrawerSection>

            <DrawerSection title={`History (${detail.history.length})`} titleGap={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.history.map((h, i) => (
                  <div key={`${h.at}-${i}`} style={{ fontSize: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--tuw-text-secondary, #5D6772)', minWidth: 140 }}>{when(h.at)}</span>
                    <span style={{ fontWeight: 600 }}>{h.from ? `${STATUS_LABEL[h.from as ReturnStatus] ?? h.from} → ` : ''}{STATUS_LABEL[h.to as ReturnStatus] ?? h.to}</span>
                    <span style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>{h.actor}{h.note ? ` — ${h.note}` : ''}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>
          </div>
        )}
      </Drawer>
    </DashboardShell>
  );
}
