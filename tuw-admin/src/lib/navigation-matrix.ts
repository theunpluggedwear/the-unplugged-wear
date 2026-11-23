export type NavMode = 'mobile' | 'desktop';
export type NavKind = 'item' | 'column' | 'link' | 'feature' | 'shopAll';
export type Path = (number | string)[];

interface NavLinkShape {
  label: string;
  href: string;
  filter?: unknown;
}
interface NavColumnShape {
  title: string;
  links: NavLinkShape[];
}
interface NavFeatureShape {
  productSlug?: string;
  image?: string;
  imagePosition?: string;
  title?: string;
  caption?: string;
  href?: string;
}
interface NavItemShape {
  label: string;
  href: string;
  columns?: NavColumnShape[];
  features?: NavFeatureShape[];
  shopAll?: NavLinkShape;
}

export interface MatrixRow {
  id: string;
  path: Path;
  arrayPath: Path;
  siblingIndex: number;
  siblingCount: number;
  depth: number;
  kind: NavKind;
  label: string;
  href: string;
  meta?: string;
  capacity?: { used: number; max: number; noun: string };
  parentId: string | null;
  hasChildren: boolean;
  searchText: string;
}

export const NAV_CAPS: Record<NavMode, { items: number; columns: number; links: number; features: number }> = {
  mobile: { items: 20, columns: 6, links: 30, features: 0 },
  desktop: { items: 8, columns: 4, links: 10, features: 2 },
};

export function toRows(items: NavItemShape[], mode: NavMode): MatrixRow[] {
  const caps = NAV_CAPS[mode];
  const rows: MatrixRow[] = [];
  items.forEach((item, i) => {
    const columns = item.columns ?? [];
    const features = item.features ?? [];
    const itemId = String(i);
    const itemMeta = mode === 'desktop'
      ? [
          features.length ? `${features.length}/${caps.features} feature tiles` : null,
          item.shopAll ? 'Shop-all link' : null,
        ].filter(Boolean).join(' · ')
      : undefined;
    rows.push({
      id: itemId,
      path: [i],
      arrayPath: [],
      siblingIndex: i,
      siblingCount: items.length,
      depth: 0,
      kind: 'item',
      label: item.label,
      href: item.href,
      meta: itemMeta,
      capacity: { used: columns.length, max: caps.columns, noun: 'columns' },
      parentId: null,
      hasChildren: columns.length > 0 || (mode === 'desktop' && (features.length > 0 || Boolean(item.shopAll))),
      searchText: [item.label, item.href, itemMeta].filter(Boolean).join(' ').toLowerCase(),
    });

    columns.forEach((column, c) => {
      const columnId = `${i}.c${c}`;
      rows.push({
        id: columnId,
        path: [i, 'columns', c],
        arrayPath: [i, 'columns'],
        siblingIndex: c,
        siblingCount: columns.length,
        depth: 1,
        kind: 'column',
        label: column.title,
        href: '',
        capacity: { used: column.links.length, max: caps.links, noun: 'links' },
        parentId: itemId,
        hasChildren: column.links.length > 0,
        searchText: column.title.toLowerCase(),
      });

      column.links.forEach((link, l) => {
        rows.push({
          id: `${columnId}.l${l}`,
          path: [i, 'columns', c, 'links', l],
          arrayPath: [i, 'columns', c, 'links'],
          siblingIndex: l,
          siblingCount: column.links.length,
          depth: 2,
          kind: 'link',
          label: link.label,
          href: link.href,
          meta: link.filter ? 'Shop filter preserved' : undefined,
          parentId: columnId,
          hasChildren: false,
          searchText: [link.label, link.href].join(' ').toLowerCase(),
        });
      });
    });

    if (mode === 'desktop') {
      features.forEach((feature, f) => {
        const featureLabel = feature.title || feature.productSlug || feature.image || 'Feature tile';
        rows.push({
          id: `${i}.f${f}`,
          path: [i, 'features', f],
          arrayPath: [i, 'features'],
          siblingIndex: f,
          siblingCount: features.length,
          depth: 1,
          kind: 'feature',
          label: featureLabel,
          href: feature.href ?? '',
          meta: 'Image tile · other fields preserved',
          parentId: itemId,
          hasChildren: false,
          searchText: [featureLabel, feature.href, feature.productSlug].filter(Boolean).join(' ').toLowerCase(),
        });
      });
      if (item.shopAll) {
        rows.push({
          id: `${i}.shop`,
          path: [i, 'shopAll'],
          arrayPath: [],
          siblingIndex: 0,
          siblingCount: 1,
          depth: 1,
          kind: 'shopAll',
          label: item.shopAll.label,
          href: item.shopAll.href,
          meta: 'Shop-all link · filter preserved',
          parentId: itemId,
          hasChildren: false,
          searchText: [item.shopAll.label, item.shopAll.href].join(' ').toLowerCase(),
        });
      }
    }
  });
  return rows;
}

export function visibleRows(rows: MatrixRow[], query: string, collapsed: Set<string>) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      rows: rows.filter((row) => {
        let parent = row.parentId;
        while (parent) {
          if (collapsed.has(parent)) return false;
          parent = rows.find((r) => r.id === parent)?.parentId ?? null;
        }
        return true;
      }),
      matches: rows.length,
    };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const keep = new Set<string>();
  let matches = 0;
  for (const row of rows) {
    if (!row.searchText.includes(q)) continue;
    matches += 1;
    let current: MatrixRow | undefined = row;
    while (current) {
      keep.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return { rows: rows.filter((row) => keep.has(row.id)), matches };
}

export function getAtPath<T = unknown>(root: T, path: Path): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current == null) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

export function patchAtPath<T>(root: T, path: Path, update: (current: unknown) => unknown): T {
  if (path.length === 0) return update(root) as T;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = patchAtPath(copy[head as number], rest, update);
    return copy as T;
  }
  const object = root as Record<string, unknown>;
  return { ...object, [head as string]: patchAtPath(object[head as string], rest, update) } as T;
}

export function moveWithinArray<T>(array: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= array.length) return array;
  const copy = [...array];
  [copy[index], copy[target]] = [copy[target]!, copy[index]!];
  return copy;
}
