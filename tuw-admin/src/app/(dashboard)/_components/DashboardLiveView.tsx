import React from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Badge, ContentCard, PageHeader, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { DashboardSummary } from '@tuw/heart/modules/analytics';
import { formatINR } from '@/lib/format';

export default function DashboardLiveView({ summary, userName }: { summary: DashboardSummary; userName: string }) {
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date());
  return (
    <DashboardShell pageTitle="Dashboard" activeNav="home">
      <PageHeader title={`Welcome back, ${userName}`} subtitle={`${date} · live store data`} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatINR(summary.revenueToday)} subtitle="Captured minus refunds" trendType="neutral" />
        <StatCard label="Paid orders" value={summary.ordersToday} subtitle="All time" trendType="neutral" />
        <StatCard label="Average order" value={formatINR(summary.averageOrder)} subtitle="Paid orders only" trendType="neutral" />
        <StatCard label="Conversion" value={`${summary.conversionRate.toFixed(1)}%`} subtitle="Sessions to orders" trendType="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentCard>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Daily revenue</h2>
          {summary.trend.length === 0 ? (
            <p style={{ color: 'var(--tuw-text-secondary)' }}>No daily rollups yet. The rollup job writes the first row.</p>
          ) : (
            <div className="space-y-2">
              {summary.trend.map((point) => (
                <div key={point.day} className="flex justify-between" style={{ fontSize: 14 }}>
                  <span>{point.day}</span>
                  <span className="tuw-tabular-nums">{formatINR(point.value)}</span>
                </div>
              ))}
            </div>
          )}
        </ContentCard>

        <ContentCard>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Inventory alerts</h2>
          {summary.inventoryAlerts.length === 0 ? (
            <p style={{ color: 'var(--tuw-text-secondary)' }}>No products are below their low-stock threshold.</p>
          ) : (
            <div className="space-y-2">
              {summary.inventoryAlerts.map((alert) => (
                <div key={alert.name} className="flex justify-between" style={{ fontSize: 14 }}>
                  <span>{alert.name}</span>
                  <Badge variant={alert.unitsLeft <= alert.threshold / 2 ? 'danger' : 'warning'}>{alert.unitsLeft} left</Badge>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      </div>

      <ContentCard padding="0px">
        <h2 style={{ padding: '20px 24px 0', fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Recent orders</h2>
        <Table>
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.recentOrders.length === 0 ? (
              <TableRow hoverable={false}><TableCell colSpan={4}>No orders yet.</TableCell></TableRow>
            ) : summary.recentOrders.map((order) => (
              <TableRow key={order.orderNumber} hoverable={false}>
                <TableCell>{order.orderNumber}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell className="tuw-tabular-nums">{formatINR(order.total)}</TableCell>
                <TableCell><Badge variant="neutral">{order.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentCard>
    </DashboardShell>
  );
}
