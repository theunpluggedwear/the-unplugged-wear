import { mobileNavItem, desktopNavItem, menu } from './schemas.ts';

export type MenuItem = typeof menu._output[number];

const identity = (item: { label: string; href: string }) =>
  `${item.label.trim().toLowerCase()}|${item.href.trim().toLowerCase()}`;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const linkFrom = (value: unknown) => {
  const raw = object(value);
  if (!raw) return null;
  const label = text(raw.label, 100);
  const href = text(raw.href, 500);
  if (!label || !href) return null;
  const filter = object(raw.filter);
  return filter ? { label, href, filter } : { label, href };
};

export function sanitizeMenu(input: unknown): MenuItem[] {
  if (!Array.isArray(input)) return [];
  const items: MenuItem[] = [];
  for (const value of input.slice(0, 20)) {
    const raw = object(value);
    if (!raw) continue;
    const label = text(raw.label, 100);
    const href = text(raw.href, 500);
    if (!label || !href) continue;
    const columns: MenuItem['columns'] = [];
    if (Array.isArray(raw.columns)) {
      for (const columnValue of raw.columns.slice(0, 6)) {
        const columnRaw = object(columnValue);
        if (!columnRaw) continue;
        const title = text(columnRaw.title, 100);
        if (!title) continue;
        const links = Array.isArray(columnRaw.links)
          ? columnRaw.links.slice(0, 30).map(linkFrom).filter((link): link is NonNullable<typeof link> => link !== null)
          : [];
        columns.push({ title, links });
      }
    }
    const features: MenuItem['features'] = [];
    if (Array.isArray(raw.features)) {
      for (const featureValue of raw.features.slice(0, 2)) {
        const featureRaw = object(featureValue);
        if (!featureRaw) continue;
        const feature: Record<string, string> = {};
        for (const key of ['productSlug', 'image', 'imagePosition', 'title', 'caption', 'href'] as const) {
          const max = key === 'image' || key === 'href' ? 500 : key === 'caption' ? 300 : key === 'title' || key === 'productSlug' ? 200 : 100;
          const value = text(featureRaw[key], max);
          if (value) feature[key] = value;
        }
        if (Object.keys(feature).length) features.push(feature as NonNullable<MenuItem['features']>[number]);
      }
    }
    const shopAll = linkFrom(raw.shopAll);
    items.push({
      label,
      href,
      columns,
      ...(features.length ? { features } : {}),
      ...(shopAll ? { shopAll } : {}),
    });
  }
  return menu.safeParse(items).success ? menu.parse(items) : [];
}

export function mergeLegacyMenu(mobile: unknown, desktop: unknown): MenuItem[] {
  const legacyMobile = sanitizeMenu(mobile);
  const legacyDesktop = sanitizeMenu(desktop);
  const merged: MenuItem[] = [];
  const seen = new Map<string, MenuItem>();

  if (legacyMobile.length) {
    for (const item of legacyMobile) {
      const next: MenuItem = {
        label: item.label,
        href: item.href,
        columns: (item.columns ?? []).map((column) => ({
          title: column.title,
          links: column.links.map((link) => ({ label: link.label, href: link.href })),
        })),
      };
      merged.push(next);
      seen.set(identity(item), next);
    }
  }

  if (legacyDesktop.length) {
    for (const item of legacyDesktop) {
      const existing = seen.get(identity(item));
      if (existing) {
        if (item.features?.length) existing.features = item.features;
        if (item.shopAll) existing.shopAll = item.shopAll;
        for (const column of item.columns ?? []) {
          const target = existing.columns?.find((candidate) => candidate.title === column.title);
          if (!target) continue;
          for (const link of column.links) {
            if (!link.filter) continue;
            const destination = target.links.find((candidate) => candidate.href === link.href);
            if (destination) destination.filter = link.filter;
          }
        }
      } else {
        merged.push({
          label: item.label,
          href: item.href,
          columns: (item.columns ?? []).map((column) => ({
            title: column.title,
            links: column.links.map((link) => ({
              label: link.label,
              href: link.href,
              ...(link.filter ? { filter: link.filter } : {}),
            })),
          })),
          ...(item.features?.length ? { features: item.features } : {}),
          ...(item.shopAll ? { shopAll: item.shopAll } : {}),
        });
      }
    }
  }

  const parsed = menu.safeParse(merged.slice(0, 20));
  return parsed.success ? parsed.data : [];
}
