import React from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { ContentCard, PageHeader, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ReportSummary } from '@tuw/heart/modules/analytics';
import { formatINR } from '@/lib/format';

export default function ReportsLiveView({ summary }: { summary: ReportSummary }) {
  return (
    <DashboardShell pageTitle="Reports">
      <PageHeader title="Analytics & Reports" subtitle="Live database aggregates. Empty means no data has been recorded yet." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatINR(summary.revenue)} subtitle="Paid orders" trendType="neutral" />
        <StatCard label="Orders" value={summary.orders} subtitle="Paid orders" trendType="neutral" />
        <StatCard label="Average order" value={formatINR(summary.aov)} subtitle="Paid orders only" trendType="neutral" />
        <StatCard label="Refunds" value={formatINR(summary.refunds)} subtitle="Issued refunds" trendType="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentCard>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Search demand</h2>
          <div className="space-y-2" style={{ fontSize: 14 }}>
            <div className="flex justify-between"><span>Total searches</span><span>{summary.searches}</span></div>
            <div className="flex justify-between"><span>Zero-result searches</span><span>{summary.zeroResults}</span></div>
          </div>
        </ContentCard>
        <ContentCard padding="0px">
          <h2 style={{ padding: '20px 24px 0', fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Most viewed products</h2>
          <Table>
            <TableHeader><TableRow hoverable={false}><TableHead>Product</TableHead><TableHead>Views</TableHead></TableRow></TableHeader>
            <TableBody>
              {summary.topProducts.length === 0 ? (
                <TableRow hoverable={false}><TableCell colSpan={2}>No product views recorded yet.</TableCell></TableRow>
              ) : summary.topProducts.map((p) => (
                <TableRow key={p.name} hoverable={false}><TableCell>{p.name}</TableCell><TableCell>{p.views}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentCard>
      </div>
    </DashboardShell>
  );
}
