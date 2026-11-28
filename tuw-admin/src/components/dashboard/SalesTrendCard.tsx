'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { BarGroup } from './BarGroup';
import { ChartFrame } from './ChartFrame';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';
import { DashboardCard } from './DashboardCard';
import { FilterMenu } from './FilterMenu';
import { TrendBadge } from './TrendBadge';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import EmptyState from '@/components/ui/EmptyState';
import { formatINRWhole, type SalesTrendPoint } from '@/lib/dashboard';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'home-' + String(p) });

const MAX_SLOTS = 7;

function padSlots(points: SalesTrendPoint[]): SalesTrendPoint[] {
  if (points.length >= MAX_SLOTS) return points.slice(0, MAX_SLOTS);
  const blanks: SalesTrendPoint[] = Array.from(
    { length: MAX_SLOTS - points.length },
    () => ({ day: '', lastWeek: 0, thisWeek: 0, lastVal: '', thisVal: '' }),
  );
  return [...points, ...blanks];
}

interface SalesTrendCardProps {
  points: SalesTrendPoint[];
  ticks: string[];
  totalValue: number;
  delta: number;
  legendPast: string;
  legendCurrent: string;
  compareLabel: string;
  timeRange: string;
  ranges: readonly string[];
  onRangeChange: (range: string) => void;
}

function barHeight(value: number, points: SalesTrendPoint[]): string {
  const max = Math.max(100, ...points.map((p) => Math.max(p.lastWeek, p.thisWeek)));
  return `${(value / max) * 100}%`;
}

export function SalesTrendCard({
  points,
  ticks,
  totalValue,
  delta,
  legendPast,
  legendCurrent,
  compareLabel,
  timeRange,
  ranges,
  onRangeChange,
}: SalesTrendCardProps) {
  const slots = padSlots(points);
  return (
    <DashboardCard
      variant="sales"
      title="Sales trend"
      action={
        <div className={styles.salesHeaderRight}>
          <ChartLegend past={legendPast} current={legendCurrent} />

          <FilterMenu
            options={ranges.map((range) => ({ value: range, label: range }))}
            value={timeRange}
            onChange={onRangeChange}
            ariaLabel="Sales time range"
          />
        </div>
      }
      subheader={
        <div className={styles.salesStatRow}>
          <AnimatedNumber
            className={`${styles.salesLargeNumber} tuw-tabular-nums`}
            value={totalValue}
            format={formatINRWhole}
            upClassName={styles.salesTotalUp}
            downClassName={styles.salesTotalDown}
          />
          <TrendBadge value={`${delta.toFixed(1)}%`} iconSize={13} iconStrokeWidth={2.5} />
          <span className={styles.trendSubtext}>{compareLabel}</span>
        </div>
      }
    >
      {points.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="No sales data"
          description="There is nothing to chart for this range yet. Try a different range."
          actionText="Reset to This week"
          onAction={() => onRangeChange('This week')}
        />
      ) : (
        <ChartFrame ticks={ticks} labels={slots.map((item) => item.day)}>
          {slots.map((item, i) => {
            const isLive = item.lastWeek !== 0 || item.thisWeek !== 0;
            return (
              <BarGroup
                key={`slot-${i}`}
                pastHeight={barHeight(item.lastWeek, slots)}
                currentHeight={barHeight(item.thisWeek, slots)}
                active={isLive}
                tooltip={
                  !isLive ? null : (
                    <ChartTooltip
                      title={item.day}
                      rows={[
                        { series: 'current', label: legendCurrent, value: item.thisVal },
                        { series: 'past', label: legendPast, value: item.lastVal },
                      ]}
                    />
                  )
                }
              />
            );
          })}
        </ChartFrame>
      )}
    </DashboardCard>
  );
}
