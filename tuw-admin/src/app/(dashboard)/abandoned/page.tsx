export const instant = false;
import { Suspense } from 'react';
import { adminGetAbandonedStats, adminListAbandoned } from '@tuw/heart/modules/analytics';
import DashboardShell from '@/components/layout/DashboardShell';
import { ContentCard, PageHeader, Skeleton, StatCard } from '@/components/ui';
import { session } from '@/server/session';
import { formatINR } from '@/lib/format';
import AbandonedLiveView from './_components/AbandonedLiveView';

function StatsFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => <ContentCard key={i}><Skeleton height="48px" /></ContentCard>)}
    </div>
  );
}

function PanelFallback() {
  return (
    <ContentCard>
      <div className="space-y-3">
        <Skeleton height="18px" width="40%" />
        <Skeleton height="16px" />
        <Skeleton height="16px" width="75%" />
      </div>
    </ContentCard>
  );
}

async function AbandonedStats({ actorId }: { actorId: string }) {
  const stats = await adminGetAbandonedStats(actorId);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="At-risk carts" value={stats.atRisk} subtitle="Awaiting reminder" trendType="neutral" />
      <StatCard label="Recoverable value" value={formatINR(stats.recoverableValue)} subtitle="Detected carts only" trendType="up" />
      <StatCard label="Recovery rate" value={`${Math.round(stats.recoveryRate)}%`} subtitle="Converted share" trendType="up" />
    </div>
  );
}

async function AbandonedTable({ actorId }: { actorId: string }) {
  const rows = await adminListAbandoned(actorId);
  return <AbandonedLiveView initial={rows} />;
}

export default async function AbandonedPage() {
  const claims = await session.requireStaff('order.view', '/abandoned');
  return (
    <DashboardShell pageTitle="Abandoned" activeNav="abandoned">
      <PageHeader title="Abandoned Carts" subtitle="Live recovery inbox from idle carts." />
      <Suspense fallback={<StatsFallback />}>
        <AbandonedStats actorId={claims.sub} />
      </Suspense>
      <Suspense fallback={<PanelFallback />}>
        <AbandonedTable actorId={claims.sub} />
      </Suspense>
    </DashboardShell>
  );
}
