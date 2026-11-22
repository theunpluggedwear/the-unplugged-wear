export interface VariantLike {
  id: string;
  color: string;
  size: string;
  sku: string;
  variantKey?: string;
  price: number;
  priceOverridden?: boolean;
  stock: number;
}

export interface ProductVariantSource {
  id: string;
  price: number;
  basePrice?: number;
  priceAdjustments?: Record<string, number>;
  stock: number;
  colors: string[];
  sizes: string[];
  variants?: VariantLike[];
}

const skuToken = (value: string, fallback: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

export function buildVariantSku(productId: string, colorIdx: number, size: string): string {
  return `${productId}-${colorIdx}-${size}`;
}

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

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
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
  return roundPrice(base + sumAdjustments(adjustments, [
    { attr: 'Color', value: color },
    { attr: 'Size', value: size },
  ]));
}

export function synthesizeVariants(product: ProductVariantSource): VariantLike[] {
  const combos: Array<{ color: string; colorIdx: number; size: string }> = [];
  product.colors.forEach((color, colorIdx) => {
    product.sizes.forEach((size) => combos.push({ color, colorIdx, size }));
  });
  const stocks = distributeStock(product.stock, combos.length);
  const base = product.basePrice ?? product.price;
  return combos.map((combo, index) => ({
    id: `${product.id}-V${index + 1}`,
    color: combo.color,
    size: combo.size,
    sku: buildVariantSku(product.id, combo.colorIdx, combo.size),
    variantKey: buildVariantKey(combo.color, combo.size),
    price: deriveVariantPrice(base, product.priceAdjustments, combo.color, combo.size),
    stock: stocks[index],
  }));
}

export function resolveVariants(product: ProductVariantSource): VariantLike[] {
  return product.variants ?? synthesizeVariants(product);
}

export function deriveColors(variants: VariantLike[]): string[] {
  return [...new Set(variants.map((v) => v.color))];
}

export function deriveSizes(variants: VariantLike[]): string[] {
  return [...new Set(variants.map((v) => v.size))];
}

export function variantStockTotal(variants: VariantLike[]): number {
  return variants.reduce((total, variant) => total + variant.stock, 0);
}

export function recomputeVariants(
  base: number,
  adjustments: Record<string, number> | undefined,
  variants: VariantLike[],
): VariantLike[] {
  return variants.map((variant) => {
    if (variant.priceOverridden) return variant;
    const price = deriveVariantPrice(base, adjustments, variant.color, variant.size);
    return price === variant.price ? variant : { ...variant, price };
  });
}

export function minFromPrice(variants: VariantLike[]): number {
  return variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;
}

export function hasPriceSpread(variants: VariantLike[]): boolean {
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
  for (const attribute of attributes) for (const value of attribute.values) valid.add(adjustmentKey(attribute.name, value));
  const next: Record<string, number> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(adjustments)) {
    if (!valid.has(key)) { dropped.push(key); continue; }
    if (!Number.isFinite(value) || value <= 0) continue;
    next[key] = roundPrice(value);
  }
  return { next, dropped };
}
