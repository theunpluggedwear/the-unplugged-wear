import React from 'react';
import Link from 'next/link';
import { DashboardCard } from './DashboardCard';
import { SeeAllLink } from './SeeAllLink';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import Badge from '@/components/ui/Badge';
import type { OrderItem } from '@/mocks/fixtures';
import type { OrderStatus } from '@tuw/heart/modules/orders';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

const STATUS_BADGE_STYLE: React.CSSProperties = {
  height: '26px',
  padding: '0 12px',
  fontSize: '12px',
};

interface RecentOrdersCardProps {
  orders: OrderItem[];
}

const STATUS_BADGE: Record<OrderStatus, { variant: 'success' | 'info' | 'warning' | 'danger'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  confirmed: { variant: 'warning', label: 'Confirmed' },
  processing: { variant: 'warning', label: 'Processing' },
  shipped: { variant: 'success', label: 'Shipped' },
  delivered: { variant: 'info', label: 'Delivered' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  failed: { variant: 'danger', label: 'Failed' },
  refunded: { variant: 'info', label: 'Refunded' },
};

function statusBadge(status: OrderStatus): { variant: 'success' | 'info' | 'warning' | 'danger'; label: string } {
  return STATUS_BADGE[status];
}

export function RecentOrdersCard({ orders }: RecentOrdersCardProps) {
  return (
    <DashboardCard
      variant="orders"
      title="Recent orders"
      action={
        <SeeAllLink href="/orders" />
      }
    >
      <Table style={{ marginTop: '16px', minWidth: '600px' }}>
        <TableHeader>
          <TableRow hoverable={false}>
            <TableHead style={{ padding: '12px 14px' }}>Order</TableHead>
            <TableHead style={{ padding: '12px 14px' }}>Customer</TableHead>
            <TableHead style={{ padding: '12px 14px' }}>Total</TableHead>
            <TableHead style={{ padding: '12px 14px', textAlign: 'right' }}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order, i) => {
            const badge = statusBadge(order.fulfillmentStatus);
            const last = i === orders.length - 1;
            return (
              <TableRow
                key={order.id}
                className={styles.orderDataRow}
                style={last ? { borderBottom: 'none' } : {}}
              >
                <TableCell style={{ padding: '14px 14px', fontWeight: 600, color: 'var(--tuw-action-primary, #7539FF)' }}>
                  <Link href="/orders" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {order.id}
                  </Link>
                </TableCell>
                <TableCell style={{ padding: '14px 14px', color: 'var(--tuw-text-secondary, #5D6772)' }}>{order.customerName}</TableCell>
                <TableCell className="tuw-tabular-nums" style={{ padding: '14px 14px', fontWeight: 600 }}>₹{order.total.toFixed(2)}</TableCell>
                <TableCell style={{ padding: '14px 14px', textAlign: 'right' }}>
                  <Badge variant={badge.variant} style={STATUS_BADGE_STYLE}>{badge.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DashboardCard>
  );
}
