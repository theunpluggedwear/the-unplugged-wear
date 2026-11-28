import type { DashboardSummary } from '@tuw/heart/modules/analytics';

export const SALES_RANGES = ['This week', 'Last week', 'This month'] as const;
export const PRODUCT_SORTS = ['By revenue', 'By units sold'] as const;

export interface SalesTrendPoint {
  day: string;
  lastWeek: number;
  thisWeek: number;
  lastVal: string;
  thisVal: string;
}

export interface TopProduct {
  name: string;
  priceLabel: string;
  sold: number;
  soldTotal: number;
  stockLabel: string;
  progressPct: number;
  image: string;
  alt: string;
}

export interface InventoryAlert {
  id: string;
  severity: 'Critical' | 'Low';
  unitsLeft: string;
  itemName: string;
  velocity: string;
  filledSegments: number;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatINRWhole(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatCompactINR(value: number): string {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    return `₹${thousands.toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(thousands) ? 0 : 1 })}K`;
  }
  return `₹${Math.round(value)}`;
}

function istDay(offsetDays: number): string {
  return new Date(Date.now() + IST_OFFSET_MS - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

export function rangeToParams(label: string): { from: string; to: string } {
  if (label === 'Last week') return { from: istDay(13), to: istDay(7) };
  if (label === 'This month') return { from: istDay(29), to: istDay(0) };
  return { from: istDay(6), to: istDay(0) };
}

export function isSalesRange(value: string | undefined): value is (typeof SALES_RANGES)[number] {
  return Boolean(value && (SALES_RANGES as readonly string[]).includes(value));
}

function bucketWeeks(rows: DashboardSummary['trend']): DashboardSummary['trend'] {
  const size = Math.max(1, Math.ceil(rows.length / 4));
  const buckets: DashboardSummary['trend'] = [];
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    buckets.push({
      day: `W${buckets.length + 1}`,
      value: slice.reduce((sum, row) => sum + row.value, 0),
      previous: slice.reduce((sum, row) => sum + row.previous, 0),
    });
  }
  return buckets;
}

function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const scaled = value / base;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return step * base;
}

export function chartTicks(maxValue: number): string[] {
  const max = niceMax(maxValue);
  return Array.from({ length: 6 }, (_, index) => formatCompactINR((max * (5 - index)) / 5));
}

export function toSalesTrend(rows: DashboardSummary['trend'], label: string): {
  points: SalesTrendPoint[];
  ticks: string[];
  total: number;
  delta: number;
  legendPast: string;
  legendCurrent: string;
  compareLabel: string;
} {
  const buckets = label === 'This month' ? bucketWeeks(rows) : rows.slice(-7);
  const maxValue = Math.max(1, ...buckets.flatMap((row) => [row.value, row.previous]));
  const points = buckets.map((row) => ({
    day: row.day,
    lastWeek: Math.round((row.previous / maxValue) * 100),
    thisWeek: Math.round((row.value / maxValue) * 100),
    lastVal: formatINRWhole(row.previous),
    thisVal: formatINRWhole(row.value),
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const previous = rows.reduce((sum, row) => sum + row.previous, 0);
  const legendCurrent = label === 'This month' ? 'This month' : label === 'Last week' ? 'Last week' : 'This week';
  const legendPast = label === 'This month' ? 'Last month' : label === 'Last week' ? '2 weeks ago' : 'Last week';
  return {
    points,
    ticks: chartTicks(maxValue),
    total,
    delta: previous > 0 ? ((total - previous) / previous) * 100 : 0,
    legendPast,
    legendCurrent,
    compareLabel: `vs ${legendPast.toLowerCase()}`,
  };
}

export function toTopProducts(
  rows: DashboardSummary['topProducts'],
  sort: string,
  storefrontOrigin: string,
): TopProduct[] {
  const products = rows.map((row) => {
    const soldTotal = row.units + row.stock;
    return {
      name: row.name,
      priceLabel: formatINRWhole(row.price),
      sold: row.units,
      soldTotal,
      stockLabel: `Stock: ${row.stock} units`,
      progressPct: soldTotal > 0 ? Math.round((row.units / soldTotal) * 100) : 0,
      image: row.imageUrl ? (row.imageUrl.startsWith('/') ? `${storefrontOrigin}${row.imageUrl}` : row.imageUrl) : '',
      alt: row.imageAlt ?? row.name,
    };
  });
  return sort === 'By units sold' ? [...products].sort((a, b) => b.sold - a.sold) : products;
}

export function toInventoryAlerts(rows: DashboardSummary['inventoryAlerts']): InventoryAlert[] {
  return rows.map((row) => ({
    id: row.name,
    severity: row.unitsLeft <= row.threshold / 2 ? 'Critical' : 'Low',
    unitsLeft: `${row.unitsLeft} units left`,
    itemName: row.name,
    velocity: `Sells: ${row.velocityPerDay.toFixed(1)} pcs/day`,
    filledSegments: Math.max(1, Math.min(4, Math.round((row.unitsLeft / Math.max(1, row.threshold)) * 4))),
  }));
}

const SPARK_UP_PATH = 'M 0 26 C 12 26, 18 10, 28 16 C 38 22, 44 26, 52 14 C 60 4, 68 8, 76 2 C 82 -2, 86 4, 90 2';
const SPARK_DOWN_PATH = 'M 0 10 C 12 10, 16 2, 24 4 C 32 6, 38 18, 48 14 C 58 10, 64 22, 74 18 C 80 15, 84 22, 90 20';

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildSparkPath(values: number[], tone: 'up' | 'down'): string {
  const fallback = tone === 'up' ? SPARK_UP_PATH : SPARK_DOWN_PATH;
  if (values.some((value) => !Number.isFinite(value))) return fallback;
  const clean = values;
  if (clean.length < 2) return fallback;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max === min) return fallback;
  const points = clean.map((value, index) => ({
    x: (index * 90) / (clean.length - 1),
    y: 34 - ((value - min) / (max - min)) * 32,
  }));
  let path = `M ${round2(points[0].x)} ${round2(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    path += ` C ${round2(p1.x + (p2.x - p0.x) / 6)} ${round2(p1.y + (p2.y - p0.y) / 6)}, ${round2(p2.x - (p3.x - p1.x) / 6)} ${round2(p2.y - (p3.y - p1.y) / 6)}, ${round2(p2.x)} ${round2(p2.y)}`;
  }
  return path;
}
