'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  DashboardHeader,
  InventoryAlertsCard,
  MetricCard,
  ProductListCard,
  RecentOrdersCard,
  SalesTrendCard,
} from '@/components/dashboard';
import type { DashboardSummary } from '@tuw/heart/modules/analytics';
import { formatINR } from '@/lib/format';
import {
  SALES_RANGES,
  isSalesRange,
  toInventoryAlerts,
  toSalesTrend,
  toTopProducts,
} from '@/lib/dashboard';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

interface DashboardLiveViewProps {
  summary: DashboardSummary;
  userName: string;
  initialLabel: string;
  rangeLabel: string;
  storefrontOrigin: string;
}

function deltaView(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return {
    text: `${sign}${Math.abs(value).toFixed(1)}%`,
    tone: (value < 0 ? 'down' : 'up') as 'up' | 'down',
    vs: 'vs previous period',
  };
}

export default function DashboardLiveView({ summary, userName, initialLabel, rangeLabel, storefrontOrigin }: DashboardLiveViewProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(rangeLabel);
  const [productSort, setProductSort] = useState('By revenue');
  useEffect(() => setTimeRange(rangeLabel), [rangeLabel]);

  const chartLabel = isSalesRange(timeRange) ? timeRange : 'This week';
  const chart = useMemo(() => toSalesTrend(summary.trend, chartLabel), [summary.trend, chartLabel]);
  const products = useMemo(() => toTopProducts(summary.topProducts, productSort, storefrontOrigin), [summary.topProducts, productSort, storefrontOrigin]);
  const alerts = useMemo(() => toInventoryAlerts(summary.inventoryAlerts), [summary.inventoryAlerts]);
  const ranges = isSalesRange(rangeLabel) ? SALES_RANGES : ['Custom range', ...SALES_RANGES];

  const revenue = deltaView(summary.deltas.revenue);
  const orders = deltaView(summary.deltas.orders);
  const average = deltaView(summary.deltas.averageOrder);
  const conversion = deltaView(summary.deltas.conversion);
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date());

  return (
    <DashboardShell pageTitle="Dashboard" activeNav="home">
      <DashboardHeader
        title={`Welcome back, ${userName}`}
        subtitle={`${date} · live store data`}
        initialLabel={initialLabel}
      />

      <section className={styles.kpiGrid} aria-label="Key Performance Indicators">
        <MetricCard
          label="Revenue"
          value={formatINR(summary.revenueToday)}
          delta={revenue.text}
          deltaTone={revenue.tone}
          vsText={revenue.vs}
          sparkTone={revenue.tone}
        />
        <MetricCard
          label="Orders"
          value={summary.ordersToday}
          tabular={false}
          delta={orders.text}
          deltaTone={orders.tone}
          vsText={orders.vs}
          sparkTone={orders.tone}
        />
        <MetricCard
          label="Average order"
          value={formatINR(summary.averageOrder)}
          delta={average.text}
          deltaTone={average.tone}
          vsText={average.vs}
          sparkTone={average.tone}
        />
        <MetricCard
          label="Conversion rate"
          value={`${summary.conversionRate.toFixed(1)}%`}
          delta={conversion.text}
          deltaTone={conversion.tone}
          vsText={conversion.vs}
          sparkTone={conversion.tone}
        />
      </section>

      <section className={styles.middleGrid}>
        <SalesTrendCard
          points={chart.points}
          ticks={chart.ticks}
          totalValue={chart.total}
          delta={chart.delta}
          legendPast={chart.legendPast}
          legendCurrent={chart.legendCurrent}
          compareLabel={chart.compareLabel}
          timeRange={timeRange}
          ranges={ranges}
          onRangeChange={(range) => router.push(`/dashboard?preset=${encodeURIComponent(range)}`)}
        />
        <ProductListCard products={products} sort={productSort} onSortChange={setProductSort} />
      </section>

      <section className={styles.bottomGrid}>
        <InventoryAlertsCard alerts={alerts} />
        <RecentOrdersCard orders={summary.recentOrders} />
      </section>
    </DashboardShell>
  );
}
