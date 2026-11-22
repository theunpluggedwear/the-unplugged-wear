'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
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
import { ContentCard, Skeleton } from '@/components/ui';
import type { DashboardKpis, DashboardSummary } from '@tuw/heart/modules/analytics';
import { formatINR } from '@/lib/format';
import {
  SALES_RANGES,
  isSalesRange,
  toInventoryAlerts,
  toSalesTrend,
  toTopProducts,
} from '@/lib/dashboard';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

type Trend = DashboardSummary['trend'];
type Products = DashboardSummary['topProducts'];
type Inventory = DashboardSummary['inventoryAlerts'];
type Orders = DashboardSummary['recentOrders'];

interface DashboardLiveViewProps {
  kpis: Promise<DashboardKpis>;
  trend: Promise<Trend>;
  products: Promise<Products>;
  inventory: Promise<Inventory>;
  orders: Promise<Orders>;
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

function CardFallback({ lines = 3 }: { lines?: number }) {
  return (
    <ContentCard>
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height="18px" width={`${92 - i * 12}%`} />
        ))}
      </div>
    </ContentCard>
  );
}

function KpiCards({ data }: { data: Promise<DashboardKpis> }) {
  const summary = use(data);
  const revenue = deltaView(summary.deltas.revenue);
  const orders = deltaView(summary.deltas.orders);
  const average = deltaView(summary.deltas.averageOrder);
  const conversion = deltaView(summary.deltas.conversion);
  return (
    <section className={styles.kpiGrid} aria-label="Key Performance Indicators">
      <MetricCard
        label="Revenue"
        value={formatINR(summary.revenueToday)}
        delta={revenue.text}
        deltaTone={revenue.tone}
        vsText={revenue.vs}
        sparkTone={revenue.tone}
        sparkValues={summary.kpiSeries.revenue}
      />
      <MetricCard
        label="Orders"
        value={summary.ordersToday}
        tabular={false}
        delta={orders.text}
        deltaTone={orders.tone}
        vsText={orders.vs}
        sparkTone={orders.tone}
        sparkValues={summary.kpiSeries.orders}
      />
      <MetricCard
        label="Average order"
        value={formatINR(summary.averageOrder)}
        delta={average.text}
        deltaTone={average.tone}
        vsText={average.vs}
        sparkTone={average.tone}
        sparkValues={summary.kpiSeries.averageOrder}
      />
      <MetricCard
        label="Conversion rate"
        value={`${summary.conversionRate.toFixed(1)}%`}
        delta={conversion.text}
        deltaTone={conversion.tone}
        vsText={conversion.vs}
        sparkTone={conversion.tone}
        sparkValues={summary.kpiSeries.conversion}
      />
    </section>
  );
}

function SalesCard({ data, timeRange, ranges, onRangeChange }: {
  data: Promise<Trend>;
  timeRange: string;
  ranges: readonly string[];
  onRangeChange: (range: string) => void;
}) {
  const rows = use(data);
  const chart = toSalesTrend(rows, isSalesRange(timeRange) ? timeRange : 'This week');
  return (
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
      onRangeChange={onRangeChange}
    />
  );
}

function ProductsCard({ data, sort, onSortChange, storefrontOrigin }: {
  data: Promise<Products>;
  sort: string;
  onSortChange: (sort: string) => void;
  storefrontOrigin: string;
}) {
  const rows = use(data);
  return <ProductListCard products={toTopProducts(rows, sort, storefrontOrigin)} sort={sort} onSortChange={onSortChange} />;
}

function InventoryCard({ data }: { data: Promise<Inventory> }) {
  return <InventoryAlertsCard alerts={toInventoryAlerts(use(data))} />;
}

function OrdersCard({ data }: { data: Promise<Orders> }) {
  return <RecentOrdersCard orders={use(data)} />;
}

export default function DashboardLiveView({
  kpis, trend, products, inventory, orders, userName, initialLabel, rangeLabel, storefrontOrigin,
}: DashboardLiveViewProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState(rangeLabel);
  const [productSort, setProductSort] = useState('By revenue');
  useEffect(() => setTimeRange(rangeLabel), [rangeLabel]);

  const ranges = isSalesRange(rangeLabel) ? SALES_RANGES : ['Custom range', ...SALES_RANGES];
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' }).format(new Date());

  return (
    <DashboardShell pageTitle="Dashboard" activeNav="home">
      <DashboardHeader
        title={`Welcome back, ${userName}`}
        subtitle={`${date} · live store data`}
        initialLabel={initialLabel}
      />

      <Suspense fallback={<CardFallback lines={4} />}>
        <KpiCards data={kpis} />
      </Suspense>

      <section className={styles.middleGrid}>
        <Suspense fallback={<CardFallback lines={6} />}>
          <SalesCard
            data={trend}
            timeRange={timeRange}
            ranges={ranges}
            onRangeChange={(range) => router.push(`/dashboard?preset=${encodeURIComponent(range)}`)}
          />
        </Suspense>
        <Suspense fallback={<CardFallback lines={4} />}>
          <ProductsCard
            data={products}
            sort={productSort}
            onSortChange={setProductSort}
            storefrontOrigin={storefrontOrigin}
          />
        </Suspense>
      </section>

      <section className={styles.bottomGrid}>
        <Suspense fallback={<CardFallback lines={4} />}>
          <InventoryCard data={inventory} />
        </Suspense>
        <Suspense fallback={<CardFallback lines={5} />}>
          <OrdersCard data={orders} />
        </Suspense>
      </section>
    </DashboardShell>
  );
}
