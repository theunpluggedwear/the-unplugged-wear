import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChartCell, baseName, colorsSizesOf, variantDraftError,
  cellAdjustment, cellPriceBreakdown, storefrontNote,
  deriveCategoryOptions, filterProducts, paginateProducts, catalogCounts,
} from '../src/app/(dashboard)/products/_components/editor/productEditorUtils.ts';

test('chart cells parse numbers, blanks and ranges without float dust', () => {
  assert.equal(parseChartCell(''), 0);
  assert.equal(parseChartCell('12.5'), 12.5);
  assert.equal(parseChartCell('10 – 12'), '10 – 12');
  assert.equal(parseChartCell('bad'), null);
});

test('naming helpers preserve current behaviour', () => {
  assert.equal(baseName('https://x/y/photo.png?w=20'), 'photo.png');
  assert.deepEqual(colorsSizesOf([{ name: 'Color', values: ['Black'] }, { name: 'Size', values: ['M'] }]),
    { colors: ['Black'], sizes: ['M'] });
  assert.equal(storefrontNote({ ok: true }), 'The storefront now shows it.');
});

test('variant validation catches blanks and duplicate keys', () => {
  const row = (color, size) => ({ id: color + size, color, size, sku: '', price: 100, stock: 1 });
  assert.equal(variantDraftError([row('Black', 'M')]), null);
  assert.match(variantDraftError([row('', 'M')]), /needs a color and a size/);
  assert.match(variantDraftError([row('Black', 'M'), row('black', 'm')]), /Duplicate variant/);
});

test('price breakdown and adjustments are deterministic', () => {
  const adjustments = { 'Color:Black': 10, 'Size:M': 5 };
  assert.equal(cellAdjustment(adjustments, 'Black', 'M'), 15);
  assert.equal(cellPriceBreakdown(adjustments, '100', 'Black', 'M', 115),
    'Base ₹100.00 + Black ₹10.00 + M ₹5.00 = ₹115.00');
});

test('catalog filters, paging and counts stay pure', () => {
  const p = (over) => ({ id: '1', name: 'Hoodie', category: 'hoodies', slug: 'hoodie',
    publicationStatus: 'published', madeToOrder: false, stock: 2, ...over });
  const products = [p({}), p({ id: '2', name: 'Tee', category: 'tees', stock: 0 })];
  assert.equal(deriveCategoryOptions(['hoodies'], products).some((o) => o.value === 'tees'), true);
  assert.equal(filterProducts(products, { search: 'tee', category: 'All', publication: 'all', stock: 'all' }).length, 1);
  assert.equal(paginateProducts(products, 1, 1).pageProducts.length, 1);
  assert.equal(catalogCounts(products).outOfStock, 1);
});
