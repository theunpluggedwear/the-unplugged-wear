import { mobileNavItem, desktopNavItem, menu } from './schemas.ts';

export type MenuItem = typeof menu._output[number];

const identity = (item: { label: string; href: string }) =>
  `${item.label.trim().toLowerCase()}|${item.href.trim().toLowerCase()}`;

export function mergeLegacyMenu(mobile: unknown, desktop: unknown): MenuItem[] {
  const legacyMobile = mobileNavItem.array().safeParse(mobile ?? []);
  const legacyDesktop = desktopNavItem.array().safeParse(desktop ?? []);
  const merged: MenuItem[] = [];
  const seen = new Map<string, MenuItem>();

  if (legacyMobile.success) {
    for (const item of legacyMobile.data) {
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

  if (legacyDesktop.success) {
    for (const item of legacyDesktop.data) {
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
