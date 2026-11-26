import type { NavColumn, NavFeature, NavItem, NavLink } from '@storefront/components/layout/navigation';
import type { ShopFilter } from './product';

interface CmsLink {
  label: string;
  href: string;
  filter?: Record<string, unknown>;
}

interface CmsFeature {
  productSlug?: string;
  image?: string;
  imagePosition?: string;
  title?: string;
  caption?: string;
  href?: string;
}

interface CmsColumn {
  title: string;
  links: CmsLink[];
}

interface CmsItem {
  label: string;
  href: string;
  columns?: CmsColumn[];
  features?: CmsFeature[];
  shopAll?: CmsLink;
}

const AUDIENCES = new Set(['men', 'women', 'kids']);

export function shopFilterFrom(value: unknown): ShopFilter | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const filter: ShopFilter = {};
  if (typeof raw.audience === 'string' && AUDIENCES.has(raw.audience)) {
    filter.audience = raw.audience as ShopFilter['audience'];
  }
  if (typeof raw.category === 'string' && raw.category.trim()) filter.category = raw.category as ShopFilter['category'];
  if (typeof raw.type === 'string' && raw.type.trim()) filter.type = raw.type as ShopFilter['type'];
  if (Array.isArray(raw.q)) {
    const words = raw.q.filter((word): word is string => typeof word === 'string' && word.trim().length > 0);
    if (words.length) filter.q = words;
  }
  if (typeof raw.isNew === 'boolean') filter.isNew = raw.isNew;
  return Object.keys(filter).length ? filter : undefined;
}

function toLink(link: CmsLink): NavLink {
  const filter = shopFilterFrom(link.filter);
  return filter ? { label: link.label, href: link.href, filter } : { label: link.label, href: link.href };
}

export function navItemsFromCms(items: CmsItem[]): NavItem[] {
  return items.map((item) => {
    const columns: NavColumn[] | undefined = item.columns?.length
      ? item.columns.map((column) => ({ title: column.title, links: column.links.map(toLink) }))
      : undefined;
    const features: NavFeature[] | undefined = item.features?.length
      ? item.features.map((feature) => ({ ...feature }))
      : undefined;
    return {
      label: item.label,
      href: item.href,
      ...(columns ? { columns } : {}),
      ...(features ? { features } : {}),
      ...(item.shopAll ? { shopAll: toLink(item.shopAll) } : {}),
    };
  });
}
