'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PackagePlus, Search, Truck } from 'lucide-react';
import type { AdminShipmentRow, ShipmentStatusValue } from '@tuw/heart/modules/fulfillment';
import {
  Badge, Button, ContentCard, Drawer, DrawerSection, EmptyState, FilterPills, Input, ItemsRow,
  Modal, PageHeader, Pagination, PanelLayout, Select, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Textarea,
} from '@/components/ui';
import { useToast } from '@/components/providers/ToastProvider';
import { addTrackingAction, getShipmentAction, listShipmentsAction, setShipmentStatusAction } from '@/server/fulfillment-actions';
import { MONO_ID_STYLE } from '@/lib/format';





const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—');
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

const STATUS_LABEL: Record<ShipmentStatusValue, string> = {
  pending: 'Not dispatched', shipped: 'Shipped', in_transit: 'In transit',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', exception: 'Exception', returned: 'Returned',
};
const STATUS_BADGE: Record<ShipmentStatusValue, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pending: 'neutral', shipped: 'info', in_transit: 'info', out_for_delivery: 'warning',
  delivered: 'success', exception: 'danger', returned: 'danger',
};

type ListResult = { rows: AdminShipmentRow[]; total: number };
type Detail = {
  row: AdminShipmentRow;
  events: { id: string; status: string; location: string | null; description: string | null; at: string }[];
};

export default function ShipmentsView({ initial, perms }: { initial: ListResult; perms: string[] }) {
  const { showToast } = useToast();
  const canManage = perms.includes('shipment.manage');

  const [list, setList] = useState<ListResult>(initial);
  const [status, setStatus] = useState<ShipmentStatusValue | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState<ShipmentStatusValue>('in_transit');
  const [statusNote, setStatusNote] = useState('');
  const [location, setLocation] = useState('');

  const [trackingOpen, setTrackingOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedAt, setShippedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [eta, setEta] = useState('');
  const [note, setNote] = useState('');

  const request = useRef(0);
  const openingInFlight = useRef(false);
  const openRequest = useRef(0);
  const load = async (over: Partial<{ status: ShipmentStatusValue | 'all'; q: string; page: number; perPage: number }> = {}) => {
    const mine = ++request.current;
    setLoading(true);
    const result = await listShipmentsAction({ status, q: searchTerm || undefined, page, perPage, ...over });
    if (mine !== request.current) return;
    setLoading(false);
    if (result.ok) setList(result.data);
    else showToast({ type: 'warning', title: 'Could Not Load Shipments', description: result.error.message });
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
    
  }, [status, searchTerm, page, perPage]);
  useEffect(() => { setPage(1); }, [status, searchTerm]);

  const openParcel = async (row: AdminShipmentRow) => {
    if (openingInFlight.current) return;
    openingInFlight.current = true;
    const mine = ++openRequest.current;
    setOpenId(row.id);
    setStatusNote('');
    setLocation('');
    setDetail(null);
    try {
      const result = await getShipmentAction({ shipmentId: row.id });
      if (mine !== openRequest.current) return;
      if (result.ok) {
        setDetail(result.data);
        setNextStatus(result.data.row.status === 'delivered' ? 'delivered' : 'in_transit');
      } else {
        showToast({ type: 'warning', title: 'Could Not Open The Parcel', description: result.error.message });
      }
    } catch (error) {
      showToast({ type: 'warning', title: 'Could Not Open The Parcel', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      openingInFlight.current = false;
      if (mine === openRequest.current) setOpenId(null);
    }
  };

  const refresh = async (id: string | null) => {
    if (id) {
      const result = await getShipmentAction({ shipmentId: id });
      if (result.ok) setDetail(result.data);
    }
    await load();
  };

  const move = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await setShipmentStatusAction({
        shipmentId: detail.row.id, status: nextStatus,
        location: location.trim() || undefined, note: statusNote.trim() || undefined,
      });
      if (!result.ok) { showToast({ type: 'warning', title: 'Could Not Update The Parcel', description: result.error.message }); return; }
      showToast({ type: 'success', title: 'Parcel Updated', description: `${detail.row.orderNumber} is now ${STATUS_LABEL[nextStatus].toLowerCase()}.` });
      setStatusNote(''); setLocation('');
      await refresh(detail.row.id);
    } catch (error) {
      showToast({ type: 'warning', title: 'Could Not Update The Parcel', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  const addTracking = async () => {
    if (orderNumber.trim().length < 5) { showToast({ type: 'warning', title: 'Order Number Required', description: 'Use the number from the order, e.g. TUW-261116-AB12C.' }); return; }
    if (carrier.trim().length < 2) { showToast({ type: 'warning', title: 'Courier Required', description: 'Name the courier that took the parcel.' }); return; }
    if (trackingNumber.trim().length < 3) { showToast({ type: 'warning', title: 'Tracking Number Required', description: 'The customer needs something to track.' }); return; }
    setBusy(true);
    try {
      const result = await addTrackingAction({
        orderNumber: orderNumber.trim().toUpperCase(), carrier: carrier.trim(), trackingNumber: trackingNumber.trim(),
        shippedAt: new Date(`${shippedAt}T12:00:00+05:30`).toISOString(),
        estimatedDeliveryAt: eta || undefined, note: note.trim() || undefined,
      });
      if (!result.ok) { showToast({ type: 'warning', title: 'Tracking Not Added', description: result.error.message }); return; }
      showToast({ type: 'success', title: 'Parcel Dispatched', description: `${result.data.orderNumber} · ${carrier.trim()} ${trackingNumber.trim()}` });
      setTrackingOpen(false);
      setOrderNumber(''); setCarrier(''); setTrackingNumber(''); setEta(''); setNote('');
      await load();
    } catch (error) {
      showToast({ type: 'warning', title: 'Tracking Not Added', description: error instanceof Error ? error.message : 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(list.total / perPage));

  return (
    <>
      <PageHeader
        title="Shipments"
        actions={
          <Button variant="primary" size="md" icon={<PackagePlus size={16} />} disabled={!canManage} onClick={() => setTrackingOpen(true)}>
            <span>Add tracking</span>
          </Button>
        }
      />

      <ContentCard>
        <PanelLayout
          scrollable={false}
          header={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <FilterPills
                variant="pills"
                ariaLabel="Parcel status"
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'shipped', label: 'Shipped' },
                  { value: 'in_transit', label: 'In transit' },
                  { value: 'out_for_delivery', label: 'Out for delivery' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'exception', label: 'Exceptions' },
                  { value: 'returned', label: 'Returned' },
                ]}
                value={status}
                onChange={(v) => setStatus(v as ShipmentStatusValue | 'all')}
              />
              <div style={{ maxWidth: 340, width: '100%' }}>
                <Input placeholder="Order #, AWB or courier…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} prefixIcon={<Search size={16} />} aria-label="Search shipments" />
              </div>
            </div>
          }
          footer={
            <Pagination
              currentPage={page} totalPages={totalPages} totalItems={list.total} pageSize={perPage}
              pageSizeOptions={[10, 15, 30]} onPageChange={setPage} onPageSizeChange={setPerPage}
            />
          }
        >
          {list.rows.length === 0 ? (
            <EmptyState
              icon={<Truck size={22} />}
              title={loading ? 'Loading…' : 'No parcel here'}
              description="Provider-synced parcels appear once the partner ships. In-house parcels use “Add tracking”."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>AWB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dispatched</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Scans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((row) => (
                  <TableRow key={row.id} onClick={() => void openParcel(row)} style={{ cursor: 'pointer' }}>
                    <TableCell style={{ fontWeight: 600 }}>{row.orderNumber}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.carrier ?? '—'}</TableCell>
                    <TableCell style={{ ...MONO_ID_STYLE, fontSize: 12 }}>{row.trackingNumber ?? '—'}</TableCell>
                    <TableCell><Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge></TableCell>
                    <TableCell>{day(row.shippedAt)}</TableCell>
                    <TableCell>{day(row.estimatedDeliveryAt)}</TableCell>
                    <TableCell>{row.eventCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelLayout>
      </ContentCard>

      <Drawer
        isOpen={openId !== null || detail !== null}
        onClose={() => { setDetail(null); setOpenId(null); }}
        width="520px"
        title={detail?.row.orderNumber ?? 'Parcel'}
        subtitle={detail ? `${detail.row.customerName} · ${STATUS_LABEL[detail.row.status]}` : undefined}
        footer={
          detail ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Select
                label="Move this parcel"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ShipmentStatusValue)}
                options={[
                  { value: 'shipped', label: 'Shipped' },
                  { value: 'in_transit', label: 'In transit' },
                  { value: 'out_for_delivery', label: 'Out for delivery' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'exception', label: 'Delivery exception' },
                  { value: 'returned', label: 'Returned / RTO' },
                ]}
              />
              <Input label="Scan location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru hub" />
              <Textarea label="Note for the timeline" rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Customer asked for a later delivery…" />
              <Button variant="primary" size="md" disabled={busy || !canManage} onClick={() => void move()}>
                <span>{busy ? 'Saving…' : 'Save movement'}</span>
              </Button>
              <p style={{ fontSize: 11, color: 'var(--tuw-text-secondary)', margin: 0 }}>
                The customer sees this note on their order timeline. Provider-synced parcels are also updated by the poll job.
              </p>
            </div>
          ) : undefined
        }
      >
        {openId ? <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>Loading the parcel…</p> : null}
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <DrawerSection title="Parcel">
              <ItemsRow
                title={`${detail.row.carrier ?? 'Courier'} · ${detail.row.trackingNumber ?? 'no AWB'}`}
                meta={`${detail.row.pieces} piece${detail.row.pieces === 1 ? '' : 's'} · dispatched ${day(detail.row.shippedAt)}${detail.row.estimatedDeliveryAt ? ` · promised ${day(detail.row.estimatedDeliveryAt)}` : ''}`}
                right={<Badge variant={STATUS_BADGE[detail.row.status]}>{STATUS_LABEL[detail.row.status]}</Badge>}
              />
            </DrawerSection>
            <DrawerSection title={`Timeline (${detail.events.length})`}>
              {detail.events.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary)' }}>No scan yet. Add the first movement above, or sync the partner from the fulfilment board.</p>
              ) : (
                detail.events.map((event) => (
                  <ItemsRow
                    key={event.id}
                    left={
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{STATUS_LABEL[event.status as ShipmentStatusValue] ?? event.status}</div>
                        <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary)' }}>
                          {when(event.at)}{event.location ? ` · ${event.location}` : ''}
                        </div>
                      </div>
                    }
                    right={event.description ? <span style={{ fontSize: 12, maxWidth: 200, textAlign: 'right' }}>{event.description}</span> : null}
                  />
                ))
              )}
            </DrawerSection>
            <p style={{ fontSize: 11, color: 'var(--tuw-text-secondary)' }}>
              Customers see this timeline on their order page. Provider-synced parcels are refreshed by the fulfilment poll job.
            </p>
          </div>
        ) : null}
      </Drawer>

      <Modal
        isOpen={trackingOpen}
        onClose={() => setTrackingOpen(false)}
        title="Add tracking"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="md" onClick={() => setTrackingOpen(false)}><span>Cancel</span></Button>
            <Button variant="primary" size="md" disabled={busy} onClick={() => void addTracking()}><span>{busy ? 'Saving…' : 'Mark dispatched'}</span></Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <Input label="Order number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="TUW-261116-AB12C" />
          <Input label="Courier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Delhivery / Blue Dart / India Post…" />
          <Input label="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="AWB" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Dispatched on" type="date" value={shippedAt} onChange={(e) => setShippedAt(e.target.value)} />
            <Input label="Promised by" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
          <Textarea label="Note for the timeline" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Handed to the courier at Indiranagar…" />
          <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary)', margin: 0 }}>
            This marks the order shipped and shows the AWB and timeline on the customer&apos;s order page.
          </p>
        </div>
      </Modal>
    </>
  );
}
