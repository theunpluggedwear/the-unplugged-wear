import { adjustmentKey, sumAdjustments } from '@tuw/heart/modules/catalog/variants';
import type { ProductItem, ProductVariant } from '@/lib/admin-dto';
import { UNCATEGORIZED_CATEGORY } from '@tuw/heart/modules/catalog/rules';

export function parseChartCell(v: number | string): number | string | null {
  if (typeof v === 'number') return v;
  const text = v.trim();
  if (text === '') return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  return /^\d+(\.\d+)?\s*[–-]\s*\d+(\.\d+)?$/.test(text) ? text : null;
}

export function baseName(url: string): string {
  const part = url.split('?')[0].split('/');
  return part[part.length - 1] || url;
}

export function colorsSizesOf(attrs: Array<{ name: string; values: string[] }>) {
  return {
    colors: attrs.find((a) => a.name === 'Color')?.values ?? [],
    sizes: attrs.find((a) => a.name === 'Size')?.values ?? [],
  };
}

export function variantDraftError(variants: ProductVariant[]): string | null {
  const seen = new Set<string>();
  for (const v of variants) {
    const color = v.color.trim();
    const size = v.size.trim();
    if (!color || !size) return 'Each variant needs a color and a size — fill the blank row or remove it.';
    const key = `${color.toLowerCase()}|${size.toLowerCase()}`;
    if (seen.has(key)) return `Duplicate variant "${v.color} / ${v.size}" — merge it or remove one.`;
    seen.add(key);
  }
  return null;
}

export function cellAdjustment(
  adjustments: Record<string, number>,
  color: string,
  size: string,
): number {
  return sumAdjustments(adjustments, [
    { attr: 'Color', value: color },
    { attr: 'Size', value: size },
  ]);
}

export function cellPriceBreakdown(
  adjustments: Record<string, number>,
  basePrice: string,
  color: string,
  size: string,
  effective: number,
): string {
  const base = parseFloat(basePrice) || 0;
  const parts: string[] = [];
  const colorAdj = adjustments[adjustmentKey('Color', color)] ?? 0;
  const sizeAdj = adjustments[adjustmentKey('Size', size)] ?? 0;
  if (colorAdj > 0) parts.push(`${color} ₹${colorAdj.toFixed(2)}`);
  if (sizeAdj > 0) parts.push(`${size} ₹${sizeAdj.toFixed(2)}`);
  return parts.length > 0
    ? `Base ₹${base.toFixed(2)} + ${parts.join(' + ')} = ₹${effective.toFixed(2)}`
    : `Base ₹${base.toFixed(2)}`;
}

export function storefrontNote(storefront: { ok: true } | { ok: false; reason: string }): string {
  return storefront.ok ? 'The storefront now shows it.' : `${storefront.reason} Shoppers will see it within the hour.`;
}

export function deriveCategoryOptions(categories: string[], products: ProductItem[]) {
  const names = [...new Set([...categories, ...products.map((product) => product.category), UNCATEGORIZED_CATEGORY])];
  return names.filter(Boolean).map((category) => ({ value: category, label: category }));
}

export function filterProducts(
  products: ProductItem[],
  filters: {
    search: string;
    category: string;
    publication: 'all' | 'published' | 'draft' | 'archived';
    stock: 'all' | 'low' | 'out';
  },
): ProductItem[] {
  return products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      p.category.toLowerCase().includes(filters.search.toLowerCase()) ||
      p.slug.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCat = filters.category === 'All' || p.category === filters.category;
    const matchesPub = filters.publication === 'all' || p.publicationStatus === filters.publication;
    const matchesStock =
      filters.stock === 'all'
        ? true
        : filters.stock === 'low'
          ? !p.madeToOrder && p.stock > 0 && p.stock <= (p.lowStockAt ?? 10)
          : !p.madeToOrder && p.stock === 0;
    return matchesSearch && matchesCat && matchesPub && matchesStock;
  });
}

export function paginateProducts(products: ProductItem[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  return {
    totalPages,
    pageProducts: products.slice((page - 1) * pageSize, page * pageSize),
  };
}

export function catalogCounts(products: ProductItem[]) {
  return {
    lowStock: products.filter((p) => !p.madeToOrder && p.stock > 0 && p.stock <= (p.lowStockAt ?? 10)).length,
    outOfStock: products.filter((p) => !p.madeToOrder && p.stock === 0).length,
    drafts: products.filter((p) => p.publicationStatus === 'draft').length,
  };
}
