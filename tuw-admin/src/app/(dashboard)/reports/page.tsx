export const instant = false;
import { Suspense } from 'react';
import {
  adminGetReportDemand,
  adminGetReportKpis,
  adminGetReportTopProducts,
} from '@tuw/heart/modules/analytics';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  ContentCard,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { session } from '@/server/session';
import { formatINR } from '@/lib/format';

function PanelFallback() {
  return (
    <ContentCard>
      <div className="space-y-3">
        <Skeleton height="18px" width="45%" />
        <Skeleton height="16px" />
        <Skeleton height="16px" width="80%" />
      </div>
    </ContentCard>
  );
}

function KpiFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <ContentCard key={i}><Skeleton height="48px" /></ContentCard>)}
    </div>
  );
}

async function ReportKpis({ actorId }: { actorId: string }) {
  const summary = await adminGetReportKpis(actorId);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Revenue" value={formatINR(summary.revenue)} subtitle="Paid orders" trendType="neutral" />
      <StatCard label="Orders" value={summary.orders} subtitle="Paid orders" trendType="neutral" />
      <StatCard label="Average order" value={formatINR(summary.aov)} subtitle="Paid orders only" trendType="neutral" />
      <StatCard label="Refunds" value={formatINR(summary.refunds)} subtitle="Issued refunds" trendType="neutral" />
    </div>
  );
}

async function SearchDemand({ actorId }: { actorId: string }) {
  const summary = await adminGetReportDemand(actorId);
  return (
    <ContentCard>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Search demand</h2>
      <div className="space-y-2" style={{ fontSize: 14 }}>
        <div className="flex justify-between"><span>Total searches</span><span>{summary.searches}</span></div>
        <div className="flex justify-between"><span>Zero-result searches</span><span>{summary.zeroResults}</span></div>
      </div>
    </ContentCard>
  );
}

async function ViewedProducts({ actorId }: { actorId: string }) {
  const products = await adminGetReportTopProducts(actorId);
  return (
    <ContentCard padding="0px">
      <h2 style={{ padding: '20px 24px 0', fontSize: 18, fontWeight: 600, color: 'var(--tuw-text-primary)' }}>Most viewed products</h2>
      <Table>
        <TableHeader>
          <TableRow hoverable={false}><TableHead>Product</TableHead><TableHead>Views</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow hoverable={false}><TableCell colSpan={2}>No product views recorded yet.</TableCell></TableRow>
          ) : products.map((p) => (
            <TableRow key={p.name} hoverable={false}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.views}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContentCard>
  );
}

export default async function ReportsPage() {
  const claims = await session.requireStaff('report.view', '/reports');
  return (
    <DashboardShell pageTitle="Reports">
      <PageHeader title="Analytics & Reports" subtitle="Live database aggregates. Empty means no data has been recorded yet." />

      <Suspense fallback={<KpiFallback />}>
        <ReportKpis actorId={claims.sub} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<PanelFallback />}>
          <SearchDemand actorId={claims.sub} />
        </Suspense>
        <Suspense fallback={<PanelFallback />}>
          <ViewedProducts actorId={claims.sub} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
