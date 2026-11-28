import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSkuRows,
  findDuplicateSkus,
  matchSkuRows,
  parseCsv,
  suggestSkuColumns,
} from '../src/plugins/personalization/csv.ts';

describe('Qikink SKU CSV parsing', () => {
  test('parses quoted cells, escaped quotes, commas and CRLF line endings', () => {
    const csv = '\uFEFFProduct,Color,Size,Store SKU,Product SKU\r\n'
      + '"Classic ""Everyday"" Tee, Black",Black,M,"v-26blk-m-001","TSH-BLK-M"\r\n'
      + 'Oxford Shirt,White,L,v-26wht-l-002,SHT-WHT-L\r\n';
    const table = parseCsv(csv);
    assert.equal(table.headers.length, 5);
    assert.equal(table.rows[0]['Product'], 'Classic "Everyday" Tee, Black');
    assert.equal(table.rows[0]['Store SKU'], 'v-26blk-m-001');
    assert.equal(table.rows[1]['Product SKU'], 'SHT-WHT-L');
  });

  test('ignores blank lines and tolerates short rows', () => {
    const table = parseCsv('Product,Color,Size,SKU\n\nTee,Black,M,v-26blk-m-001\nShort,Red\n');
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[1]['SKU'], '');
  });

  test('returns an empty table for empty input', () => {
    assert.deepEqual(parseCsv('   '), { headers: [], rows: [] });
  });

  test('recognises Store SKU and Product SKU header aliases', () => {
    const table = parseCsv('Product,Color,Size,Store SKU,Product SKU\nTee,Black,M,v-26blk-m-001,TSH-BLK-M\n');
    const columns = suggestSkuColumns(table);
    assert.equal(columns.product, 'Product');
    assert.equal(columns.color, 'Color');
    assert.equal(columns.size, 'Size');
    assert.equal(columns.storeSku, 'Store SKU');
    assert.equal(columns.productSku, 'Product SKU');
  });

  test('sniffs long v- codes when only one SKU column exists', () => {
    const table = parseCsv('Product,Color,Size,SKU\nTee,Black,M,v-26blk-m-001\nHoodie,Grey,L,v-26gry-l-002\n');
    const columns = suggestSkuColumns(table);
    assert.equal(columns.storeSku, 'SKU');
    assert.equal(columns.productSku, '');
  });

  test('sniffs the v- column when both SKU columns are present but unlabelled', () => {
    const table = parseCsv('Product,Color,Size,SKU A,SKU B\nTee,Black,M,TSH-BLK-M,v-26blk-m-001\n');
    const columns = suggestSkuColumns(table);
    assert.equal(columns.storeSku, 'SKU B');
    assert.equal(columns.productSku, 'SKU A');
  });

  test('detects duplicate Store SKUs case-insensitively and after trimming', () => {
    const rows = extractSkuRows(
      parseCsv('Product,Color,Size,Store SKU\nTee,Black,M, v-26blk-m-001 \nTee,Black,L,v-26BLK-M-001\nHoodie,Grey,L,v-26gry-l-002\n'),
      suggestSkuColumns(parseCsv('Product,Color,Size,Store SKU\nTee,Black,M,v-26blk-m-001\n')),
    );
    assert.deepEqual(findDuplicateSkus(rows), ['v-26blk-m-001']);
  });
});

describe('Qikink SKU variant matching', () => {
  const variants = [
    { id: '11111111-1111-4111-8111-111111111111', sku: 'TSH-BLK-M', color: 'Black', size: 'M' },
    { id: '22222222-2222-4222-8222-222222222222', sku: 'SHT-WHT-L', color: 'White', size: 'L' },
  ];

  test('matches by our SKU first, then by colour and size', () => {
    const table = parseCsv('Product,Color,Size,Store SKU,Product SKU\nTee,Blue,M,v-1,TSH-BLK-M\nShirt,White,L,v-2,NO-SUCH-SKU\n');
    const rows = extractSkuRows(table, suggestSkuColumns(table));
    const result = matchSkuRows(rows, variants);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].variantId, variants[0].id);
    assert.equal(result.rows[0].providerSku, 'v-1');
    assert.equal(result.rows[1].variantId, variants[1].id);
    assert.equal(result.rows[1].payload.productSku, 'NO-SUCH-SKU');
  });

  test('reports unmatched rows, rows without a Store SKU and duplicates', () => {
    const table = parseCsv('Product,Color,Size,Store SKU,Product SKU\nTee,Purple,XL,v-1,NONE\nTee,Black,M,,TSH-BLK-M\nTee,Black,M,v-2,TSH-BLK-M\nTee,Black,L,V-2,TSH-BLK-L\n');
    const rows = extractSkuRows(table, suggestSkuColumns(table));
    const result = matchSkuRows(rows, variants);
    assert.equal(result.rows.length, 1);
    assert.equal(result.unmatched.length, 2);
    assert.equal(result.skipped.length, 1);
    assert.deepEqual(result.duplicates, ['v-2']);
  });

  test('never produces duplicate provider SKUs in the save payload', () => {
    const table = parseCsv('Product,Color,Size,Store SKU,Product SKU\nTee,Black,M,v-dup,TSH-BLK-M\nShirt,White,L,v-dup,SHT-WHT-L\n');
    const result = matchSkuRows(extractSkuRows(table, suggestSkuColumns(table)), variants);
    assert.equal(result.duplicates.length, 1);
    assert.equal(new Set(result.rows.map((row) => row.providerSku.toLowerCase())).size, result.rows.length - 1);
  });
});
