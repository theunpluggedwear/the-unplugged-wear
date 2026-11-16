import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';

export const CMS_TAGS = {
  home: 'cms:home',
  pages: 'cms:pages',
  nav: 'cms:nav',
  theme: 'cms:theme',
} as const;

export interface CmsSection {
  id: string;
  key: string;
  pageKey: string;
  type: string;
  title: string | null;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  sortOrder: number;
}

export async function getHomeSections(): Promise<CmsSection[]> {
  const { rows } = await getDb().execute<{
    id: string; key: string; page_key: string; type: string; title: string | null;
    content: Record<string, unknown>; settings: Record<string, unknown>; sort_order: number;
  }>(sql`SELECT id, key, page_key, type, title, content, settings, sort_order FROM cms_sections WHERE page_key = 'home' AND is_active ORDER BY sort_order, key`);
  return rows.map((r) => ({ id: r.id, key: r.key, pageKey: r.page_key, type: r.type, title: r.title, content: r.content, settings: r.settings, sortOrder: r.sort_order }));
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  blocks: Record<string, unknown>[];
  seo: Record<string, unknown> | null;
  isActive: boolean;
  updatedAt: string;
}

export async function listPages(): Promise<CmsPage[]> {
  const { rows } = await getDb().execute<{ id: string; slug: string; title: string; blocks: Record<string, unknown>[]; seo: Record<string, unknown> | null; is_active: boolean; updated_at: string }>(sql`
    SELECT id, slug, title, blocks, seo, is_active, updated_at FROM pages ORDER BY slug`);
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, blocks: r.blocks, seo: r.seo, isActive: r.is_active, updatedAt: r.updated_at }));
}

export async function getPage(slug: string): Promise<CmsPage | null> {
  const { rows } = await getDb().execute<{ id: string; slug: string; title: string; blocks: Record<string, unknown>[]; seo: Record<string, unknown> | null; is_active: boolean; updated_at: string }>(sql`
    SELECT id, slug, title, blocks, seo, is_active, updated_at FROM pages WHERE slug = ${slug} AND is_active`);
  const r = rows[0];
  return r ? { id: r.id, slug: r.slug, title: r.title, blocks: r.blocks, seo: r.seo, isActive: r.is_active, updatedAt: r.updated_at } : null;
}

export async function savePage(input: { slug: string; title: string; blocks: Record<string, unknown>[]; seo?: Record<string, unknown> | null; isActive: boolean }, actorId: string): Promise<CmsPage> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; updated_at: string }>(sql`
      INSERT INTO pages (id, slug, title, blocks, seo, is_active, created_at, updated_at)
      VALUES (${uuidv7()}, ${input.slug}, ${input.title}, ${JSON.stringify(input.blocks)}::jsonb,
              ${input.seo ? JSON.stringify(input.seo) : null}::jsonb, ${input.isActive}, now(), now())
      ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, blocks = EXCLUDED.blocks, seo = EXCLUDED.seo,
        is_active = EXCLUDED.is_active, updated_at = now()
      RETURNING id, updated_at`);
    const r = rows[0]!;
    return { id: r.id, slug: input.slug, title: input.title, blocks: input.blocks, seo: input.seo ?? null, isActive: input.isActive, updatedAt: r.updated_at };
  });
}

export async function getNavigation(): Promise<Record<string, unknown>> {
  const { rows } = await getDb().execute<{ navbar: Record<string, unknown> }>(sql`SELECT navbar FROM navigation_settings WHERE scope = 'global'`);
  return rows[0]?.navbar ?? {};
}

export async function saveNavigation(navbar: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
  await withTransaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO navigation_settings (id, scope, navbar, created_at, updated_at)
      VALUES (${uuidv7()}, 'global', ${JSON.stringify(navbar)}::jsonb, now(), now())
      ON CONFLICT (scope) DO UPDATE SET navbar = EXCLUDED.navbar, updated_at = now()`);
  });
  return navbar;
}

export async function getTheme(): Promise<{ theme: Record<string, unknown>; version: number }> {
  const { rows } = await getDb().execute<{ theme: Record<string, unknown>; version: number }>(sql`SELECT theme, version FROM cms_settings WHERE scope = 'global'`);
  return rows[0] ?? { theme: {}, version: 0 };
}

export async function saveTheme(theme: Record<string, unknown>): Promise<{ theme: Record<string, unknown>; version: number }> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ version: number }>(sql`
      INSERT INTO cms_settings (id, scope, theme, version, created_at, updated_at)
      VALUES (${uuidv7()}, 'global', ${JSON.stringify(theme)}::jsonb, 1, now(), now())
      ON CONFLICT (scope) DO UPDATE SET theme = EXCLUDED.theme, version = cms_settings.version + 1, updated_at = now()
      RETURNING version`);
    return { theme, version: rows[0]!.version };
  });
}
