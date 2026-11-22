'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Download, RefreshCw, Search, Send, Truck, XCircle } from 'lucide-react';
import type {
  AdminFulfillmentDetail,
  AdminFulfillmentList,
  AdminFulfillmentRow,
  BoardTab,
  ClaimRow,
  FulfillmentStatusValue,
} from '@tuw/heart/modules/fulfillment';
import {
  Badge, Button, ContentCard, Drawer, DrawerSection, EmptyState, FilterPills, Input, ItemsRow,
  PageHeader, Pagination, PanelLayout, Select, StatCard, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Textarea,
} from '@/components/ui';
import { useToast } from '@/components/providers/ToastProvider';
import {
  cancelFulfillmentAction, createClaimAction, getFulfillmentAction, listFulfillmentAction,
  reshipAction, retryFulfillmentAction, setProviderStateAction, submitWaitingAction,
  syncFulfillmentAction, updateClaimAction,
} from '@/server/fulfillment-actions';
import WalletPanel from './WalletPanel';
import CodPanel from './CodPanel';






const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'sub-' + String(p) });

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

const STATUS_LABEL: Record<'waiting' | FulfillmentStatusValue, string> = {
  waiting: 'Waiting for the window',
  pending: 'Pending',
  submitted: 'Accepted by partner',
  on_hold: 'On hold',
  in_production: 'In production',
  shipped: 'Shipped',
  delivery_exception: 'Delivery exception',
  delivered: 'Delivered',
  rto_initiated: 'Returning (RTO)',
  returned: 'Returned',
  cancelled: 'Cancelled',
  failed: 'Failed',
};
const STATUS_BADGE: Record<'waiting' | FulfillmentStatusValue, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  waiting: 'neutral', pending: 'info', submitted: 'info', on_hold: 'warning', in_production: 'info',
  shipped: 'success', delivery_exception: 'danger', delivered: 'success', rto_initiated: 'warning',
  returned: 'danger', cancelled: 'neutral', failed: 'danger',
};
const CLAIM_LABEL: Record<string, string> = {
  damaged: 'Damaged', misprint: 'Misprint', wrong_item: 'Wrong item', missing_item: 'Missing item',
  size_discrepancy: 'Size discrepancy', lost_in_transit: 'Lost in transit',
};
const CLAIM_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral', submitted: 'info', approved: 'warning', rejected: 'danger', resolved: 'success',
};

const TABS: { value: BoardTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'queue', label: 'Partner queue' },
  { value: 'hold', label: 'On hold' },
  { value: 'in_production', label: 'In production' },
  { value: 'shipped', label: 'In transit' },
  { value: 'issues', label: 'Issues' },
];

export default function FulfillmentView({ initial, perms, autoSubmit, health }: {
  initial: AdminFulfillmentList;
  perms: string[];
  autoSubmit: boolean;
  health: { configured: boolean; baseUrl: string; simulated: boolean };
}) {
  const { showToast } = useToast();
  const canManage = perms.includes('shipment.manage');

  const [mode, setMode] = useState<'board' | 'wallet' | 'cod'>('board');
  const [list, setList] = useState<AdminFulfillmentList>(initial);
  const [tab, setTab] = useState<BoardTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<AdminFulfillmentDetail | null>(null);
  const [openRow, setOpenRow] = useState<AdminFulfillmentRow | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [manualState, setManualState] = useState<FulfillmentStatusValue>('in_production');

  const [claimType, setClaimType] = useState<'damaged' | 'misprint' | 'wrong_item' | 'missing_item' | 'size_discrepancy' | 'lost_in_transit'>('damaged');
  const [claimNote, setClaimNote] = useState('');
  const [decisionClaim, setDecisionClaim] = useState<string | null>(null);
  const [decision, setDecision] = useState<'reprint' | 'wallet_credit' | 'refund' | 'none'>('reprint');
  const [creditRupees, setCreditRupees] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  const request = useRef(0);
  const load = async (over: Partial<{ tab: BoardTab; q: string; page: number; perPage: number }> = {}) => {
    const mine = ++request.current;
    setLoading(true);
    try {
      const result = await listFulfillmentAction({ tab, q: searchTerm || undefined, page, perPage, ...over });
      if (mine !== request.current) return;
      if (result.ok) setList(result.data);
      else showToast({ type: 'warning', title: 'Could Not Load Fulfilment', description: result.error.message });
    } catch {
      if (mine === request.current) showToast({ type: 'warning', title: 'Could Not Load Fulfilment', description: 'The request failed. Please try again.' });
    } finally {
      if (mine === request.current) setLoading(false);
    }
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
    
  }, [tab, searchTerm, page, perPage]);
  useEffect(() => { setPage(1); }, [tab, searchTerm]);

  const refresh = async (fulfillmentId: string | null) => {
    if (fulfillmentId) {
      const result = await getFulfillmentAction({ fulfillmentId });
      if (result.ok) setDetail(result.data);
    }
    await load();
  };

  const openRequest = useRef(0);
  const openingInFlight = useRef(false);

  
  
  const chooseDecisionClaim = (claimId: string | null) => {
    setDecisionClaim(claimId);
    if (claimId !== null) {
      setDecision('reprint');
      setCreditRupees('');
      setDecisionNote('');
    }
  };

  const openOrder = async (row: AdminFulfillmentRow) => {
    if (openingInFlight.current) return;
    openingInFlight.current = true;
    const mine = ++openRequest.current;
    setOpenRow(row);
    setDetail(null);
    setCancelNote('');
    setConfirmCancel(false);
    chooseDecisionClaim(null);
    setClaimNote('');
    if (!row.fulfillmentId) {
      openingInFlight.current = false;
      return;
    }
    setOpeningId(row.id);
    try {
      const result = await getFulfillmentAction({ fulfillmentId: row.fulfillmentId });
      if (mine !== openRequest.current) return;
      if (result.ok) setDetail(result.data);
      else showToast({ type: 'warning', title: 'Could Not Open The Order', description: result.error.message });
    } catch {
      if (mine === openRequest.current) showToast({ type: 'warning', title: 'Could Not Open The Order', description: 'The request failed. Please try again.' });
    } finally {
      openingInFlight.current = false;
      if (mine === openRequest.current) setOpeningId(null);
    }
  };

  const closeDrawer = () => { setOpenRow(null); setDetail(null); };

  
  const withBusy = async <T,>(run: () => Promise<T>, failureTitle: string): Promise<T | null> => {
    setBusy(true);
    try {
      return await run();
    } catch {
      showToast({ type: 'warning', title: failureTitle, description: 'The request failed. Please try again.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendWaiting = async (row: AdminFulfillmentRow) => {
    const result = await withBusy(() => submitWaitingAction({ orderNumber: row.orderNumber }), 'Not Sent');
    if (!result) return;
    if (!result.ok) {
      showToast({ type: 'warning', title: 'Not Sent', description: result.error.message });
      return;
    }
    showToast({
      type: result.data.failed ? 'warning' : 'success',
      title: result.data.failed ? 'Partner Refused' : `Sent ${result.data.orderNumber}`,
      description: result.data.message,
    });
    await refresh(null);
    if (result.data.sent && openRow) {
      const again = await listFulfillmentAction({ tab: 'all', q: result.data.orderNumber, page: 1, perPage: 5 });
      if (again.ok && again.data.rows[0]?.fulfillmentId) await openOrder(again.data.rows[0]);
    }
  };

  const submitAllWaiting = async () => {
    if (!list.rows.length) return;
    await withBusy(async () => {
      let sent = 0;
      let failed = 0;
      for (const row of [...list.rows]) {
        const result = await submitWaitingAction({ orderNumber: row.orderNumber });
        if (result.ok && !result.data.failed) sent += 1;
        else failed += 1;
      }
      showToast({
        type: failed ? 'warning' : 'success',
        title: 'Batch Submission Complete',
        description: `${sent} sent · ${failed} refused. ${failed ? 'Open a refused order to read the partner message.' : ''}`.trim(),
      });
      await load();
    }, 'Batch sync failed');
  };

  const retry = async () => {
    if (!detail) return;
    const result = await withBusy(() => retryFulfillmentAction({ fulfillmentId: detail.row.id }), 'Retry Failed');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Retry Failed', description: result.error.message }); return; }
    showToast({ type: result.data.failed ? 'warning' : 'success', title: result.data.failed ? 'Partner Refused' : 'Resubmitted', description: result.data.message });
    await refresh(detail.row.id);
  };

  const sync = async () => {
    if (!detail) return;
    const result = await withBusy(() => syncFulfillmentAction({ fulfillmentId: detail.row.id }), 'Partner Did Not Answer');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Partner Did Not Answer', description: result.error.message }); return; }
    showToast({ type: 'success', title: 'Partner Status', description: `${result.data.providerStatus}${result.data.awb ? ` · ${result.data.awb}` : ''}` });
    await refresh(detail.row.id);
  };

  const cancelOrder = async () => {
    if (!detail) return;
    const result = await withBusy(() => cancelFulfillmentAction({ fulfillmentId: detail.row.id, note: cancelNote || undefined }), 'Cancel Refused');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Cancel Refused', description: result.error.message }); return; }
    showToast({
      type: 'success', title: 'Cancelled With Partner',
      description: result.data.refundedPaise ? `${inr(result.data.refundedPaise)} credited back to the prepaid wallet.` : `Partner state: ${result.data.providerStatus}.`,
    });
    setConfirmCancel(false);
    await refresh(detail.row.id);
  };

  const reship = async () => {
    if (!detail) return;
    const result = await withBusy(() => reshipAction({ fulfillmentId: detail.row.id }), 'Re-ship Failed');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Re-ship Failed', description: result.error.message }); return; }
    showToast({
      type: result.data.status === 'sent' ? 'success' : 'warning',
      title: result.data.status === 'sent' ? 'Re-ship Sent' : 'Re-ship Failed',
      description: result.data.status === 'sent' ? `New partner order for ${result.data.orderNumber}.` : result.data.error,
    });
    await refresh(detail.row.id);
  };

  const moveManually = async () => {
    if (!detail) return;
    const result = await withBusy(() => setProviderStateAction({ fulfillmentId: detail.row.id, status: manualState }), 'Could Not Move It');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Could Not Move It', description: result.error.message }); return; }
    showToast({ type: 'success', title: 'Parcel Updated', description: `Marked ${STATUS_LABEL[manualState].toLowerCase()}.` });
    await refresh(detail.row.id);
  };

  const raiseClaim = async () => {
    if (!detail) return;
    const result = await withBusy(() => createClaimAction({ fulfillmentId: detail.row.id, type: claimType, customerNote: claimNote || undefined }), 'Claim Not Raised');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Claim Not Raised', description: result.error.message }); return; }
    showToast({ type: 'success', title: 'Claim Drafted', description: 'Evidence is attached from the customer request. Submit it once you have checked it.' });
    setClaimNote('');
    await refresh(detail.row.id);
  };

  const moveClaim = async (claim: ClaimRow, to: 'submitted' | 'rejected' | 'approved' | 'resolved') => {
    const result = await withBusy(() => updateClaimAction({
      claimId: claim.id, status: to,
      resolution: to === 'approved' || to === 'resolved' ? decision : undefined,
      staffNote: decisionNote || undefined,
      amountPaise: (to === 'approved' || to === 'resolved') && decision === 'wallet_credit' && Number(creditRupees) > 0
        ? Math.round(Number(creditRupees) * 100) : undefined,
    }), 'Claim Not Updated');
    if (!result) return;
    if (!result.ok) { showToast({ type: 'warning', title: 'Claim Not Updated', description: result.error.message }); return; }
    showToast({ type: 'success', title: `Claim ${result.data.status}`, description: result.data.resolution ? `Resolution: ${result.data.resolution.replace(/_/g, ' ')}.` : undefined });
    if (result.data.status === 'resolved') {
      setDecisionClaim(null);
      setDecision('reprint');
      setCreditRupees('');
      setDecisionNote('');
    }
    if (detail) await refresh(detail.row.id);
  };

  const exportCsv = () => {
    if (!list.rows.length) { showToast({ type: 'warning', title: 'Nothing to Export', description: 'No orders match these filters.' }); return; }
    const head = ['Order', 'Customer', 'Email', 'Partner', 'State', 'Provider state', 'Payment', 'COD (INR)', 'Cost (INR)', 'AWB', 'Items', 'Submitted'];
    const body = list.rows.map((r) => [
      r.orderNumber, r.customerName, r.customerEmail, r.provider ?? '—', r.status, r.providerStatus ?? '',
      r.gateway, (r.codPaise / 100).toFixed(2), r.providerCostPaise === null ? '' : (r.providerCostPaise / 100).toFixed(2),
      r.awb ?? '', String(r.itemCount), r.submittedAt ?? '',
    ]);
    const csv = [head, ...body].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fulfillment-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const stats = list.stats;
  const totalPages = Math.max(1, Math.ceil(list.total / perPage));
  const detailOpen = openRow !== null;
  const status = detail?.row.status ?? openRow?.status ?? 'waiting';
  const cancelable = detail ? ['pending', 'submitted', 'on_hold', 'in_production', 'failed'].includes(detail.row.status) : false;
  const reshippable = detail ? ['shipped', 'delivery_exception', 'delivered', 'rto_initiated', 'returned'].includes(detail.row.status) : false;

  return (
    <>
      <PageHeader
        title="Fulfilment & Shipping"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterPills
              variant="pills"
              ariaLabel="Fulfilment views"
              options={[{ value: 'board', label: 'Board' }, { value: 'wallet', label: 'Prepaid wallet' }, { value: 'cod', label: 'COD & remittances' }]}
              value={mode}
              onChange={(v) => setMode(v as typeof mode)}
            />
            {mode === 'board' ? (
              <Button variant="secondary" size="md" icon={<Download size={16} />} onClick={exportCsv}>
                <span>Export CSV</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {mode === 'board' ? (
        <>
          <div className={styles.statGrid}>
            <StatCard label="Waiting" value={String(stats.waiting)} subtitle="Window closed → sent by the job" trendType={stats.waiting ? 'down' : 'up'} hoverable />
            <StatCard label="At The Partner" value={String(stats.queue + stats.inProduction)} subtitle={`${stats.hold} on hold · ${stats.inProduction} in production`} trendType="neutral" hoverable />
            <StatCard label="In Transit" value={String(stats.shipped)} subtitle={`${stats.delivered30d} delivered in 30 days`} trendType="up" hoverable />
            <StatCard label="Needs A Human" value={String(stats.issues)} subtitle={stats.codPendingPaise ? `${inr(stats.codPendingPaise)} COD unremitted` : 'No provider errors'} trendType={stats.issues ? 'down' : 'up'} hoverable />
          </div>

          <ContentCard>
            <PanelLayout
              scrollable={false}
              header={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <FilterPills variant="pills" ariaLabel="Fulfilment queue" options={TABS} value={tab} onChange={(v) => setTab(v as BoardTab)} />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {tab === 'waiting' && list.rows.length ? (
                        <Button variant="primary" size="md" icon={<Send size={15} />} onClick={submitAllWaiting} disabled={busy || !canManage}>
                          <span>{busy ? 'Sending…' : `Send all ${list.rows.length}`}</span>
                        </Button>
                      ) : null}
                      <div style={{ maxWidth: 340, width: '100%' }}>
                        <Input placeholder="Order #, name, email or AWB…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} prefixIcon={<Search size={16} />} aria-label="Search fulfilment" />
                      </div>
                    </div>
                  </div>
                  {tab === 'waiting' ? (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--tuw-text-secondary)' }}>
                      A paid order is sent to its print partner when its free-cancel window closes. Sending before then skips the customer&apos;s right to cancel.
                    </p>
                  ) : null}
                  {!autoSubmit ? (
                    <p style={{ margin: 0, fontSize: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--tuw-warning-50, #FFFAEB)', color: 'var(--tuw-warning-700, #B54708)' }}>
                      Automatic submission is off in Settings → Fulfilment, so nothing leaves this page until you press “Send now”.
                    </p>
                  ) : null}
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--tuw-text-secondary)' }}>
                    {health.simulated
                      ? 'Simulator: no Qikink keys in env, so no order leaves the app.'
                      : `Qikink API: ${health.baseUrl.replace(/^https?:\/\//, '')} · keys configured server-side.`}
                  </p>
                </div>
              }
              footer={
                <Pagination
                  currentPage={page} totalPages={totalPages} totalItems={list.total} pageSize={perPage}
                  pageSizeOptions={[10, 20, 50]} onPageChange={setPage} onPageSizeChange={setPerPage}
                />
              }
            >
              {list.rows.length === 0 ? (
                <EmptyState
                  icon={<Truck size={22} />}
                  title={loading ? 'Loading…' : 'Nothing here'}
                  description={tab === 'waiting' ? 'No paid order is waiting for its cancel window.' : 'No order matches this filter.'}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>AWB</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.rows.map((row) => (
                      <TableRow key={`${row.id}-${row.status}`} onClick={() => void openOrder(row)} style={{ cursor: 'pointer' }}>
                        <TableCell>
                          <div style={{ fontWeight: 600 }}>{row.orderNumber}</div>
                          <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)' }}>
                            {row.gateway === 'cod' ? `COD ${inr(row.codPaise)}` : 'Prepaid'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{row.customerName}</div>
                          <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)' }}>{row.customerEmail}</div>
                        </TableCell>
                        <TableCell>{row.provider ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                          {row.lastError ? (
                            <div style={{ fontSize: 12, color: 'var(--tuw-danger-600, #D14343)', marginTop: 4, maxWidth: 220 }}>
                              {row.lastError.slice(0, 70)}
                            </div>
                          ) : row.providerStatus ? (
                            <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', marginTop: 4 }}>{row.providerStatus}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.awb ?? '—'}</TableCell>
                        <TableCell>{row.itemCount}</TableCell>
                        <TableCell>{row.providerCostPaise === null ? '—' : inr(row.providerCostPaise)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </PanelLayout>
          </ContentCard>
        </>
      ) : null}

      {mode === 'wallet' ? <WalletPanel onToast={showToast} canManage={canManage} /> : null}
      {mode === 'cod' ? <CodPanel onToast={showToast} canManage={canManage} /> : null}

      <Drawer
        isOpen={detailOpen}
        onClose={closeDrawer}
        width="560px"
        title={openRow?.orderNumber ?? 'Order'}
        subtitle={openRow ? `${openRow.customerName} · ${STATUS_LABEL[status]}` : undefined}
        footer={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {status === 'waiting' && openRow ? (
              <Button variant="primary" size="md" icon={<Send size={15} />} disabled={busy || !canManage} onClick={() => void sendWaiting(openRow)}>
                <span>{busy ? 'Sending…' : 'Send to partner now'}</span>
              </Button>
            ) : null}
            {detail && detail.row.status === 'failed' ? (
              <Button variant="primary" size="md" icon={<RefreshCw size={15} />} disabled={busy || !canManage} onClick={() => void retry()}>
                <span>Retry</span>
              </Button>
            ) : null}
            {detail ? (
              <Button variant="secondary" size="md" icon={<RefreshCw size={15} />} disabled={busy || !canManage} onClick={() => void sync()}>
                <span>Sync partner</span>
              </Button>
            ) : null}
            {reshippable ? (
              <Button variant="secondary" size="md" icon={<ArrowRightLeft size={15} />} disabled={busy || !canManage} onClick={() => void reship()}>
                <span>Re-ship</span>
              </Button>
            ) : null}
            {cancelable && !confirmCancel ? (
              <Button variant="secondary" size="md" icon={<XCircle size={15} />} disabled={busy || !canManage} onClick={() => setConfirmCancel(true)}>
                <span>Cancel</span>
              </Button>
            ) : null}
          </div>
        }
      >
        {openingId ? <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>Loading the partner record…</p> : null}

        {openRow && !detail && !openingId ? (
          <DrawerSection title="Waiting for the free-cancel window">
            <ItemsRow title={openRow.orderNumber} meta={`${openRow.itemCount} printable line${openRow.itemCount === 1 ? '' : 's'} · ${openRow.gateway === 'cod' ? `COD ${inr(openRow.codPaise)}` : 'prepaid'}`} right={<Badge variant="neutral">Not sent</Badge>} />
            <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)', marginTop: 12 }}>
              {openRow.cancellableUntil
                ? `The customer can still cancel until ${when(openRow.cancellableUntil)}. The submit job sends it right after.`
                : 'The window has closed — the next submit job run picks it up. You can send it now.'}
            </p>
          </DrawerSection>
        ) : null}

        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <DrawerSection title="Partner order">
              <ItemsRow
                title={`${detail.row.provider} · ${detail.row.providerStatus ?? STATUS_LABEL[detail.row.status]}`}
                meta={[
                  detail.row.awb ? `${detail.row.courier ?? 'Courier'} · ${detail.row.awb}` : null,
                  detail.row.submittedAt ? `Sent ${when(detail.row.submittedAt)}` : 'Not submitted yet',
                  detail.row.submitAttempts ? `${detail.row.submitAttempts} attempt${detail.row.submitAttempts === 1 ? '' : 's'}` : null,
                  detail.row.providerCostPaise !== null ? `Cost ${inr(detail.row.providerCostPaise)}` : null,
                ].filter(Boolean).join(' · ')}
                right={<Badge variant={STATUS_BADGE[detail.row.status]}>{STATUS_LABEL[detail.row.status]}</Badge>}
              />
              {detail.row.lastError ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--tuw-danger-50, #FEF3F2)', color: 'var(--tuw-danger-700, #B42318)', fontSize: 12 }}>
                  <AlertTriangle size={15} /> <span>{detail.row.lastError}</span>
                </div>
              ) : null}
              {detail.row.gateway === 'cod' ? (
                <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', marginTop: 10 }}>
                  Cash on delivery · {inr(detail.row.codPaise)} to collect. The courier pays this back as one remittance (COD tab).
                </p>
              ) : null}
            </DrawerSection>

            <DrawerSection title={`Sent to the partner (${detail.items.length})`}>
              {detail.items.map((item) => (
                <ItemsRow key={item.id} title={item.productName} meta={`SKU ${item.sku} · qty ${item.qty}`} right={<span>{inr(item.unitPaise * item.qty)}</span>} />
              ))}
            </DrawerSection>

            {detail.row.providerSlug === 'custom_atelier' || health.simulated ? (
              <DrawerSection title="Move the parcel by hand">
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Move the parcel to"
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value as FulfillmentStatusValue)}
                      options={[
                        { value: 'in_production', label: 'In production' },
                        { value: 'shipped', label: 'Shipped' },
                        { value: 'delivered', label: 'Delivered' },
                        { value: 'returned', label: 'Returned' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                    />
                  </div>
                  <Button variant="secondary" size="md" disabled={busy || !canManage} onClick={() => void moveManually()}>
                    <span>Save</span>
                  </Button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', marginTop: 8 }}>
                  {detail.row.providerSlug === 'custom_atelier'
                    ? 'Custom Atelier has no API — you move it here and add the courier on Shipments.'
                    : 'No keys, or a row the simulator took: move it here. The partner will not be told.'}
                </p>
              </DrawerSection>
            ) : null}

            <DrawerSection title={`Timeline (${detail.events.length})`}>
              {detail.events.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>No courier scan yet. Sync the partner to pull the latest.</p>
              ) : (
                [...detail.events].reverse().map((event, i) => (
                  <ItemsRow key={`${event.at}-${i}`} title={event.status.replace(/_/g, ' ')} meta={`${when(event.at)}${event.location ? ` · ${event.location}` : ''}`} right={<span style={{ fontSize: 12 }}>{event.description ?? ''}</span>} />
                ))
              )}
            </DrawerSection>

            <DrawerSection title={`Prepaid wallet (${detail.wallet.length})`}>
              {detail.wallet.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>Nothing charged for this order yet.</p>
              ) : (
                detail.wallet.map((entry, i) => (
                  <ItemsRow key={`${entry.createdAt}-${i}`} title={entry.kind.replace(/_/g, ' ')} meta={`${when(entry.createdAt)}${entry.note ? ` · ${entry.note}` : ''}`} right={<span>{entry.direction === 'credit' ? '+' : '−'}{inr(entry.amountPaise)}</span>} />
                ))
              )}
            </DrawerSection>

            <DrawerSection title={`Partner claims (${detail.claims.length})`}>
              {detail.claims.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>No claim raised. Claims need the customer&apos;s photos (and the unboxing video for wrong or missing items).</p>
              ) : (
                detail.claims.map((claim) => (
                  <div key={claim.id} style={{ padding: 12, borderRadius: 8, background: 'var(--tuw-bg-canvas, #F7F8F9)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{CLAIM_LABEL[claim.type] ?? claim.type}</div>
                      <Badge variant={CLAIM_BADGE[claim.status] ?? 'neutral'}>{claim.status}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', marginTop: 4 }}>
                      {claim.evidenceCount} evidence file{claim.evidenceCount === 1 ? '' : 's'}
                      {claim.hasUnboxingVideo ? ' (unboxing video)' : ''}
                      {claim.claimDeadline ? ` · window closes ${claim.claimDeadline.slice(0, 10)}` : ''}
                      {claim.resolution ? ` · ${claim.resolution.replace(/_/g, ' ')}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {claim.status === 'draft' ? (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void moveClaim(claim, 'submitted')}><span>Submit claim</span></Button>
                      ) : null}
                      {claim.status === 'submitted' ? (
                        <>
                          <Button variant="secondary" size="sm" disabled={busy} onClick={() => chooseDecisionClaim(claim.id === decisionClaim ? null : claim.id)}>
                            <span>{decisionClaim === claim.id ? 'Hide decision' : 'Decide'}</span>
                          </Button>
                          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void moveClaim(claim, 'rejected')}><span>Reject</span></Button>
                        </>
                      ) : null}
                      {claim.status === 'approved' ? (
                        <Button variant="primary" size="sm" disabled={busy} onClick={() => void moveClaim(claim, 'resolved')}><span>Mark resolved</span></Button>
                      ) : null}
                    </div>
                    {decisionClaim === claim.id ? (
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <Select
                          label="Partner agreed to"
                          value={decision}
                          onChange={(e) => setDecision(e.target.value as typeof decision)}
                          options={[
                            { value: 'reprint', label: 'Reprint' },
                            { value: 'wallet_credit', label: 'Credit our prepaid wallet' },
                            { value: 'refund', label: 'Refund to the customer' },
                            { value: 'none', label: 'Nothing' },
                          ]}
                        />
                        {decision === 'wallet_credit' ? (
                          <Input label="Credit amount (₹)" inputMode="decimal" value={creditRupees} onChange={(e) => setCreditRupees(e.target.value)} placeholder="e.g. 349.00" />
                        ) : null}
                        <Textarea label="Staff note" rows={2} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="What the partner said…" />
                        <Button variant="primary" size="sm" disabled={busy} onClick={() => void moveClaim(claim, 'approved')}><span>Approve claim</span></Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {detail.row.status === 'delivered' || detail.row.status === 'shipped' ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--tuw-border-subtle, #ECEDEF)' }}>
                  <Select
                    label="Raise a claim"
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value as typeof claimType)}
                    options={[
                      { value: 'damaged', label: 'Damaged on arrival' },
                      { value: 'misprint', label: 'Misprint' },
                      { value: 'wrong_item', label: 'Wrong item (needs unboxing video)' },
                      { value: 'missing_item', label: 'Missing item (needs unboxing video)' },
                      { value: 'size_discrepancy', label: 'Size discrepancy' },
                      { value: 'lost_in_transit', label: 'Lost in transit' },
                    ]}
                  />
                  <Textarea label="Note for the evidence pack" rows={2} value={claimNote} onChange={(e) => setClaimNote(e.target.value)} placeholder="What is wrong…" />
                  <Button variant="secondary" size="sm" icon={<AlertTriangle size={14} />} disabled={busy || !canManage} onClick={() => void raiseClaim()}>
                    <span>Create draft claim</span>
                  </Button>
                  <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', margin: 0 }}>
                    Evidence is copied from the customer&apos;s latest return request on this order.
                  </p>
                </div>
              ) : null}
            </DrawerSection>

            {confirmCancel ? (
              <DrawerSection title="Cancel with the partner">
                <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>
                  The partner decides: Qikink cancels while the order is still &ldquo;Live&rdquo;. Anything already charged is credited back to the prepaid wallet.
                </p>
                <Textarea label="Reason (kept internally)" rows={2} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="Why this order is being cancelled…" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button variant="primary" size="md" disabled={busy} onClick={() => void cancelOrder()}><span>Confirm cancel</span></Button>
                  <Button variant="secondary" size="md" disabled={busy} onClick={() => setConfirmCancel(false)}><span>Keep it</span></Button>
                </div>
              </DrawerSection>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
