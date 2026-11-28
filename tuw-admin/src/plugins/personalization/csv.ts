export type SkuColumnKey = 'product' | 'color' | 'size' | 'storeSku' | 'productSku';

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export interface SkuColumns {
  product: string;
  color: string;
  size: string;
  storeSku: string;
  productSku: string;
}

export interface SkuRow {
  product: string;
  color: string;
  size: string;
  storeSku: string;
  productSku: string;
}

export interface VariantRef {
  id: string;
  sku: string;
  color: string;
  size: string;
}

export interface SkuMatchRow {
  variantId: string;
  providerSku: string;
  payload: Record<string, string>;
}

export interface SkuMatchResult {
  rows: SkuMatchRow[];
  unmatched: SkuRow[];
  skipped: SkuRow[];
  duplicates: string[];
}

export const emptySkuColumns = (): SkuColumns => ({ product: '', color: '', size: '', storeSku: '', productSku: '' });

const ALIASES: Record<SkuColumnKey, readonly string[]> = {
  product: ['product', 'productname', 'producttitle', 'title', 'item', 'design', 'style'],
  color: ['color', 'colour', 'variantcolor', 'shade', 'fabriccolor'],
  size: ['size', 'variantsize', 'productsize'],
  storeSku: ['storesku', 'storeproductsku', 'yourproductsku', 'yourstoreproductsku', 'yoursku', 'merchantsku', 'customsku', 'storeskucode'],
  productSku: ['productsku', 'qikinksku', 'qikinkproductsku', 'sku', 'skucode', 'variantsku', 'skunumber'],
};

export function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const isStoreSkuValue = (value: string): boolean => /^v-[a-z0-9][a-z0-9_-]{3,}$/i.test(value.trim());

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const base = header.trim() || 'Column';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function parseCsv(text: string): CsvTable {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      record.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || record.length) {
    record.push(cell);
    records.push(record);
  }
  const filled = records.filter((row) => row.some((value) => value.trim() !== ''));
  if (!filled.length) return { headers: [], rows: [] };
  const headers = uniqueHeaders(filled[0]!);
  const rows = filled.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim()])));
  return { headers, rows };
}

export function suggestSkuColumns(table: CsvTable): SkuColumns {
  const byAlias = (key: SkuColumnKey): string => {
    const aliases = ALIASES[key];
    return table.headers.find((header) => aliases.includes(normalizeHeader(header))) ?? '';
  };
  const product = byAlias('product');
  const color = byAlias('color');
  const size = byAlias('size');
  const reserved = new Set([product, color, size].filter(Boolean));
  const candidates = table.headers.filter((header) => !reserved.has(header));
  const scored = candidates.map((header) => {
    const values = table.rows.map((row) => row[header] ?? '').filter((value) => value.trim());
    return { header, storeish: values.filter(isStoreSkuValue).length, filled: values.length };
  });
  const explicitStore = byAlias('storeSku');
  const explicitProduct = byAlias('productSku');
  const sniffed = scored
    .filter((entry) => entry.storeish > 0)
    .sort((a, b) => b.storeish - a.storeish || b.filled - a.filled)[0]?.header ?? '';
  let storeSku = explicitStore && explicitStore !== explicitProduct
    ? explicitStore
    : sniffed
      || candidates.find((header) => normalizeHeader(header).includes('sku') && header !== explicitProduct)
      || '';
  if (!storeSku && explicitStore && explicitStore !== product) storeSku = explicitStore;
  let productSku = explicitProduct && explicitProduct !== storeSku
    ? explicitProduct
    : candidates.find((header) => header !== storeSku && normalizeHeader(header).includes('sku')) ?? '';
  if (productSku === storeSku) productSku = '';
  return { product, color, size, storeSku, productSku };
}

export function extractSkuRows(table: CsvTable, columns: SkuColumns): SkuRow[] {
  const read = (row: Record<string, string>, header: string): string => (header ? row[header] ?? '' : '').trim();
  return table.rows.map((row) => ({
    product: read(row, columns.product),
    color: read(row, columns.color),
    size: read(row, columns.size),
    storeSku: read(row, columns.storeSku),
    productSku: read(row, columns.productSku),
  }));
}

export function findDuplicateSkus(rows: readonly SkuRow[], key: 'storeSku' | 'productSku' = 'storeSku'): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key].trim().toLowerCase();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

const norm = (value: string): string => value.trim().toLowerCase();

export function matchSkuRows(rows: readonly SkuRow[], variants: readonly VariantRef[]): SkuMatchResult {
  const bySku = new Map<string, string>();
  const byLabel = new Map<string, string>();
  for (const variant of variants) {
    if (variant.sku.trim()) bySku.set(norm(variant.sku), variant.id);
    byLabel.set(`${norm(variant.color)}|${norm(variant.size)}`, variant.id);
  }
  const matched: SkuMatchRow[] = [];
  const unmatched: SkuRow[] = [];
  const skipped: SkuRow[] = [];
  for (const row of rows) {
    if (!row.storeSku.trim()) {
      skipped.push(row);
      continue;
    }
    const variantId = (row.productSku.trim() ? bySku.get(norm(row.productSku)) : undefined)
      ?? byLabel.get(`${norm(row.color)}|${norm(row.size)}`);
    if (!variantId) {
      unmatched.push(row);
      continue;
    }
    matched.push({
      variantId,
      providerSku: row.storeSku.trim(),
      payload: {
        source: 'qikink-sku-csv',
        ...(row.product ? { product: row.product } : {}),
        ...(row.color ? { color: row.color } : {}),
        ...(row.size ? { size: row.size } : {}),
        ...(row.productSku ? { productSku: row.productSku } : {}),
      },
    });
  }
  return { rows: matched, unmatched, skipped, duplicates: findDuplicateSkus(rows) };
}
