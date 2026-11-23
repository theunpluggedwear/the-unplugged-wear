import React from 'react';
import { Skeleton } from '@/components/ui';

const cardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  border: '1px solid var(--tuw-border-subtle, #E9E9E9)',
  backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
};

function Root({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${label}`} className="flex w-full min-w-0 flex-col gap-5">
      {children}
    </div>
  );
}

export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton height={28} width={260} />
        <Skeleton height={14} width={380} />
      </div>
      {action ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Skeleton height={36} width={112} />
          <Skeleton height={36} width={132} />
        </div>
      ) : null}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={cardStyle}>
          <Skeleton height={14} width="55%" />
          <div style={{ height: 12 }} />
          <Skeleton height={30} width="70%" />
          <div style={{ height: 12 }} />
          <Skeleton height={18} width="45%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonFilters({ pills = 4, tabs = 4, search = true }: {
  pills?: number; tabs?: number; search?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {Array.from({ length: pills }, (_, i) => <Skeleton key={i} height={32} width={96} borderRadius={16} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Array.from({ length: tabs }, (_, i) => <Skeleton key={i} height={30} width={72} />)}
        </div>
        {search ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <Skeleton height={38} width={220} />
            <Skeleton height={38} width={140} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SkeletonTable({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--tuw-border-subtle, #E9E9E9)' }}>
        <Skeleton height={14} width="35%" />
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: r === rows - 1 ? 'none' : '1px solid var(--tuw-border-subtle, #E9E9E9)' }}>
          {Array.from({ length: columns }, (_, c) => <Skeleton key={c} height={14} width={c === 0 ? '22%' : `${70 / (columns - 1)}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={cardStyle}>
          <Skeleton height={18} width="60%" />
          <div style={{ height: 14 }} />
          <Skeleton height={14} />
          <div style={{ height: 10 }} />
          <Skeleton height={14} width="75%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ height = 300 }: { height?: number }) {
  return (
    <div style={cardStyle}>
      <Skeleton height={18} width="40%" />
      <div style={{ height: 18 }} />
      <Skeleton height={height} />
    </div>
  );
}

function TablePage({ label, stats = 4, pills = 0, tabs = 0, columns = 5 }: {
  label: string; stats?: number; pills?: number; tabs?: number; columns?: number;
}) {
  return (
    <Root label={label}>
      <SkeletonHeader />
      {stats > 0 ? <SkeletonStats count={stats} /> : null}
      {pills > 0 || tabs > 0 ? <SkeletonFilters pills={pills} tabs={tabs} /> : null}
      <SkeletonTable columns={columns} />
    </Root>
  );
}

export function ProductsSkeleton() {
  return (
    <Root label="Products">
      <SkeletonHeader />
      <SkeletonStats count={4} />
      <SkeletonFilters pills={4} tabs={4} />
      <SkeletonCards count={4} />
    </Root>
  );
}

export function OrdersSkeleton() { return <TablePage label="Orders" stats={4} pills={4} columns={6} />; }
export function CustomersSkeleton() { return <TablePage label="Customers" stats={4} columns={6} />; }
export function CollectionsSkeleton() { return <TablePage label="Collections" stats={4} columns={5} />; }
export function DiscountsSkeleton() { return <TablePage label="Discounts" stats={3} pills={4} tabs={3} columns={5} />; }
export function PaymentsSkeleton() { return <TablePage label="Payments" stats={3} pills={3} columns={6} />; }
export function RefundsSkeleton() { return <TablePage label="Refunds" stats={3} pills={3} columns={6} />; }
export function TeamSkeleton() { return <TablePage label="Team" stats={4} columns={5} />; }
export function CategoriesSkeleton() { return <TablePage label="Categories" stats={0} columns={4} />; }
export function ReviewsSkeleton() {
  return (
    <Root label="Reviews">
      <SkeletonHeader action={false} />
      <SkeletonCards count={4} />
    </Root>
  );
}

export function SettingsSkeleton() {
  return (
    <Root label="Settings">
      <SkeletonHeader action={false} />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        <div style={cardStyle}>
          {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ marginBottom: 14 }}><Skeleton height={16} /></div>)}
        </div>
        <div style={cardStyle}>
          <Skeleton height={18} width="45%" />
          <div style={{ height: 20 }} />
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ marginBottom: 18 }}><Skeleton height={14} width="70%" /><div style={{ height: 8 }} /><Skeleton height={38} /></div>)}
        </div>
      </div>
    </Root>
  );
}

export function AttributesSkeleton() {
  return (
    <Root label="Attribute Library">
      <SkeletonHeader action={false} />
      <SkeletonCards count={4} />
      <SkeletonTable columns={4} rows={5} />
    </Root>
  );
}

export function AppFallbackSkeleton() {
  return (
    <Root label="admin page">
      <SkeletonHeader />
      <SkeletonStats count={4} />
      <SkeletonPanel height={280} />
    </Root>
  );
}

export function DashboardSkeleton() {
  return (
    <Root label="Dashboard">
      <SkeletonHeader action={false} />
      <SkeletonStats count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonPanel height={300} />
        <SkeletonPanel height={300} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonPanel height={240} />
        <SkeletonPanel height={240} />
      </div>
    </Root>
  );
}

export function ReportsSkeleton() {
  return (
    <Root label="Reports">
      <SkeletonHeader action={false} />
      <SkeletonStats count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonPanel height={220} />
        <SkeletonPanel height={220} />
      </div>
    </Root>
  );
}

export function AbandonedSkeleton() {
  return (
    <Root label="Abandoned Carts">
      <SkeletonHeader action={false} />
      <SkeletonStats count={3} />
      <SkeletonTable columns={6} />
    </Root>
  );
}
