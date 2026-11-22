import type { ProductItem, ProductVariant } from './fixtures';



export function buildVariantSku(productId: string, colorIdx: number, size: string): string {
  return `${productId}-${colorIdx}-${size}`;
}

const skuToken = (value: string, fallback: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;



export function buildVariantSkuFromOption(productId: string, color: string, size: string): string {
  return `${productId}-${skuToken(color, 'default')}-${skuToken(size, 'standard')}`;
}


export function buildVariantKey(color: string, size: string): string {
  return `${skuToken(color, 'default')}::${skuToken(size, 'standard')}`;
}



export function distributeStock(stock: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(stock / count);
  const remainder = stock % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}





export function synthesizeVariants(p: {
  id: string;
  price: number;
  basePrice?: number;
  priceAdjustments?: Record<string, number>;
  stock: number;
  colors: string[];
  sizes: string[];
}): ProductVariant[] {
  const combos: Array<{ color: string; colorIdx: number; size: string }> = [];
  p.colors.forEach((color, colorIdx) => {
    p.sizes.forEach((size) => {
      combos.push({ color, colorIdx, size });
    });
  });
  const stocks = distributeStock(p.stock, combos.length);
  const base = p.basePrice ?? p.price;
  return combos.map((c, i) => ({
    id: `${p.id}-V${i + 1}`,
    color: c.color,
    size: c.size,
    sku: buildVariantSku(p.id, c.colorIdx, c.size),
    variantKey: buildVariantKey(c.color, c.size),
    price: deriveVariantPrice(base, p.priceAdjustments, c.color, c.size),
    stock: stocks[i],
  }));
}



export function resolveVariants(p: ProductItem): ProductVariant[] {
  return p.variants ?? synthesizeVariants(p);
}


export function deriveColors(variants: ProductVariant[]): string[] {
  return [...new Set(variants.map((v) => v.color))];
}

export function deriveSizes(variants: ProductVariant[]): string[] {
  return [...new Set(variants.map((v) => v.size))];
}


export function variantStockTotal(variants: ProductVariant[]): number {
  return variants.reduce((n, v) => n + v.stock, 0);
}


export function roundPrice(n: number): number {
  return Math.round(n * 100) / 100;
}


export function adjustmentKey(attrName: string, value: string): string {
  return `${attrName}:${value}`;
}


export function sumAdjustments(
  adjustments: Record<string, number> | undefined,
  parts: Array<{ attr: string; value: string }>,
): number {
  if (!adjustments) return 0;
  let sum = 0;
  for (const { attr, value } of parts) {
    if (!value) continue;
    const n = adjustments[adjustmentKey(attr, value)];
    if (typeof n === 'number' && Number.isFinite(n)) sum += n;
  }
  return roundPrice(sum);
}



export function deriveVariantPrice(
  base: number,
  adjustments: Record<string, number> | undefined,
  color: string,
  size: string,
): number {
  const sum =
    base +
    sumAdjustments(adjustments, [
      { attr: 'Color', value: color },
      { attr: 'Size', value: size },
    ]);
  return roundPrice(sum);
}



export function recomputeVariants(
  base: number,
  adjustments: Record<string, number> | undefined,
  variants: ProductVariant[],
): ProductVariant[] {
  return variants.map((v) => {
    if (v.priceOverridden) return v;
    const price = deriveVariantPrice(base, adjustments, v.color, v.size);
    return price === v.price ? v : { ...v, price };
  });
}


export function minFromPrice(variants: ProductVariant[]): number {
  return variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;
}


export function hasPriceSpread(variants: ProductVariant[]): boolean {
  if (variants.length < 2) return false;
  const first = variants[0].price;
  return variants.some((v) => v.price !== first);
}





export function pruneAdjustments(
  adjustments: Record<string, number> | undefined,
  attributes: Array<{ name: string; values: string[] }>,
): { next: Record<string, number>; dropped: string[] } {
  if (!adjustments) return { next: {}, dropped: [] };
  const valid = new Set<string>();
  for (const a of attributes) for (const v of a.values) valid.add(adjustmentKey(a.name, v));
  const next: Record<string, number> = {};
  const dropped: string[] = [];
  for (const [key, n] of Object.entries(adjustments)) {
    if (!valid.has(key)) {
      dropped.push(key);
      continue;
    }
    if (!Number.isFinite(n) || n <= 0) continue;
    next[key] = roundPrice(n);
  }
  return { next, dropped };
}
