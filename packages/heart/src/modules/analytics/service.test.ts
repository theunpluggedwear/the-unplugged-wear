import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentDelta, shiftWindow, toKpiSeries } from './service.ts';

test('percentDelta is signed, stable at zero and guarded against division by zero', () => {
  assert.equal(percentDelta(120, 100), 20);
  assert.equal(percentDelta(80, 100), -20);
  assert.equal(percentDelta(100, 100), 0);
  assert.equal(percentDelta(100, 0), 0);
  assert.equal(percentDelta(0, 0), 0);
  assert.equal(percentDelta(Number.NaN, 100), Number.NaN);
});

test('shiftWindow returns the equal-length window immediately before the selected one', () => {
  const from = new Date('2026-11-16T00:00:00+05:30');
  const to = new Date('2026-11-22T23:59:59+05:30');
  const prev = shiftWindow(from, to);
  assert.equal(prev.from?.toISOString(), new Date('2026-11-09T00:00:00+05:30').toISOString());
  assert.equal(prev.to?.toISOString(), new Date('2026-11-15T23:59:59+05:30').toISOString());
  const days = Math.floor(((prev.to?.getTime() ?? 0) - (prev.from?.getTime() ?? 0)) / 86400000) + 1;
  assert.equal(days, 7);
});

test('shiftWindow leaves an unfiltered range unfiltered', () => {
  assert.deepEqual(shiftWindow(null, null), { from: null, to: null });
  assert.deepEqual(shiftWindow(new Date('2026-11-16T00:00:00+05:30'), null), { from: null, to: null });
});

test('shiftWindow handles a single-day range', () => {
  const from = new Date('2026-11-22T00:00:00+05:30');
  const to = new Date('2026-11-22T23:59:59+05:30');
  const prev = shiftWindow(from, to);
  assert.equal(prev.from?.toISOString(), new Date('2026-11-21T00:00:00+05:30').toISOString());
  assert.equal(prev.to?.toISOString(), new Date('2026-11-21T23:59:59+05:30').toISOString());
});

test('toKpiSeries derives all four series from daily rows in ascending order', () => {
  const rows = [
    { revenue: '2000', conversions: 2, unique_visitors: 100, page_views: 500 },
    { revenue: '1000', conversions: 1, unique_visitors: 50, page_views: 200 },
  ];
  const series = toKpiSeries(rows);
  assert.deepEqual(series.revenue, [1000, 2000]);
  assert.deepEqual(series.orders, [1, 2]);
  assert.deepEqual(series.averageOrder, [1000, 1000]);
  assert.deepEqual(series.conversion, [2, 2]);
});

test('toKpiSeries guards zero denominators and caps at seven points', () => {
  const rows = Array.from({ length: 9 }, () => ({
    revenue: '500', conversions: 0, unique_visitors: 0, page_views: 0,
  }));
  const series = toKpiSeries(rows);
  assert.equal(series.revenue.length, 7);
  assert.ok(series.revenue.every((v) => v === 500));
  assert.ok(series.orders.every((v) => v === 0));
  assert.ok(series.averageOrder.every((v) => v === 0));
  assert.ok(series.conversion.every((v) => v === 0));
});

test('toKpiSeries falls back to page views when unique visitors are missing', () => {
  const series = toKpiSeries([{ revenue: '900', conversions: 3, unique_visitors: 0, page_views: 60 }]);
  assert.deepEqual(series.conversion, [5]);
});
