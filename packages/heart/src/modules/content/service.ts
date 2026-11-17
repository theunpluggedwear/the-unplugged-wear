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

export const FAQ_TAG = 'faqs';

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

export interface Faq {
  id: string;
  scope: 'general' | 'product' | 'category';
  productId: string | null;
  categoryId: string | null;
  groupLabel: string | null;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  productName?: string | null;
  categoryName?: string | null;
}

const FAQ_SELECT = sql`SELECT f.id, f.scope, f.product_id, f.category_id, f.group_label, f.question, f.answer,
  f.sort_order, f.is_published, p.name AS product_name, c.name AS category_name
  FROM faqs f LEFT JOIN products p ON p.id = f.product_id LEFT JOIN categories c ON c.id = f.category_id`;

function toFaq(r: Record<string, unknown>): Faq {
  return {
    id: String(r.id), scope: r.scope as Faq['scope'],
    productId: r.product_id ? String(r.product_id) : null,
    categoryId: r.category_id ? String(r.category_id) : null,
    groupLabel: r.group_label ? String(r.group_label) : null,
    question: String(r.question), answer: String(r.answer),
    sortOrder: Number(r.sort_order), isPublished: Boolean(r.is_published),
    ...(r.product_name ? { productName: String(r.product_name) } : {}),
    ...(r.category_name ? { categoryName: String(r.category_name) } : {}),
  };
}

export async function listAllFaqs(): Promise<Faq[]> {
  const { rows } = await getDb().execute<Record<string, unknown>>(sql`${FAQ_SELECT} ORDER BY f.scope, f.group_label, f.sort_order, f.created_at`);
  return rows.map(toFaq);
}

export interface GeneralFaqGroup { label: string; faqs: Faq[] }

export async function listGeneralFaqs(): Promise<GeneralFaqGroup[]> {
  const { rows } = await getDb().execute<Record<string, unknown>>(sql`${FAQ_SELECT}
    WHERE f.scope = 'general' AND f.is_published
    ORDER BY f.group_label NULLS LAST, f.sort_order, f.created_at`);
  const groups = new Map<string, Faq[]>();
  for (const raw of rows) {
    const faq = toFaq(raw);
    const label = faq.groupLabel ?? 'General';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(faq);
  }
  return [...groups].map(([label, faqs]) => ({ label, faqs }));
}

export async function listProductFaqs(productId: string, categoryId?: string | null): Promise<Faq[]> {
  const { rows } = await getDb().execute<Record<string, unknown>>(sql`${FAQ_SELECT}
    WHERE f.is_published AND ((f.scope = 'product' AND f.product_id = ${productId}::uuid)
      ${categoryId ? sql`OR (f.scope = 'category' AND f.category_id = ${categoryId}::uuid)` : sql``})
    ORDER BY f.sort_order, f.created_at`);
  return rows.map(toFaq);
}

export async function saveFaq(input: {
  id?: string;
  scope: 'general' | 'product' | 'category';
  productId?: string | null;
  categoryId?: string | null;
  groupLabel?: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
}, actorId: string): Promise<Faq> {
  return withTransaction(async (tx) => {
    const id = input.id ?? uuidv7();
    if (input.id) {
      const { rows } = await tx.execute<{ id: string }>(sql`SELECT id FROM faqs WHERE id = ${input.id}::uuid`);
      if (!rows.length) throw new AppError('NOT_FOUND', 'FAQ not found.');
      await tx.execute(sql`UPDATE faqs SET scope=${input.scope}, product_id=${input.productId ?? null},
        category_id=${input.categoryId ?? null}, group_label=${input.groupLabel ?? null}, question=${input.question},
        answer=${input.answer}, sort_order=${input.sortOrder ?? 0}, is_published=${input.isPublished ?? false}, updated_at=now()
        WHERE id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO faqs (id, scope, product_id, category_id, group_label, question, answer, sort_order, is_published, created_by)
        VALUES (${id}::uuid, ${input.scope}, ${input.productId ?? null}, ${input.categoryId ?? null}, ${input.groupLabel ?? null},
          ${input.question}, ${input.answer}, ${input.sortOrder ?? 0}, ${input.isPublished ?? false}, ${actorId}::uuid)`);
    }
    const { rows } = await tx.execute<Record<string, unknown>>(sql`${FAQ_SELECT} WHERE f.id = ${id}::uuid`);
    return toFaq(rows[0]!);
  });
}

export async function deleteFaq(id: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`DELETE FROM faqs WHERE id = ${id}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'FAQ not found.');
  });
}

export async function listSections(pageKey: string): Promise<CmsSection[]> {
  const { rows } = await getDb().execute<{
    id: string; key: string; page_key: string; type: string; title: string | null;
    content: Record<string, unknown>; settings: Record<string, unknown>; sort_order: number;
  }>(sql`SELECT id, key, page_key, type, title, content, settings, sort_order FROM cms_sections WHERE page_key = ${pageKey} ORDER BY sort_order, key`);
  return rows.map((r) => ({ id: r.id, key: r.key, pageKey: r.page_key, type: r.type, title: r.title, content: r.content, settings: r.settings, sortOrder: r.sort_order }));
}

export async function saveSection(input: {
  id?: string; key: string; pageKey: string; type: string; title?: string | null;
  content: Record<string, unknown>; settings?: Record<string, unknown>; sortOrder?: number; isActive?: boolean;
}, actorId: string): Promise<CmsSection> {
  return withTransaction(async (tx) => {
    const id = input.id ?? uuidv7();
    if (input.id) {
      const { rowCount } = await tx.execute(sql`SELECT 1 FROM cms_sections WHERE id = ${input.id}::uuid`);
      if (!rowCount) throw new AppError('NOT_FOUND', 'Section not found.');
      await tx.execute(sql`UPDATE cms_sections SET key=${input.key}, page_key=${input.pageKey}, type=${input.type}, title=${input.title ?? null},
        content=${JSON.stringify(input.content)}::jsonb, settings=${JSON.stringify(input.settings ?? {})}::jsonb,
        sort_order=${input.sortOrder ?? 0}, is_active=${input.isActive ?? true}, updated_at=now() WHERE id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO cms_sections (id, key, page_key, type, title, content, settings, sort_order, is_active)
        VALUES (${id}::uuid, ${input.key}, ${input.pageKey}, ${input.type}, ${input.title ?? null}, ${JSON.stringify(input.content)}::jsonb,
          ${JSON.stringify(input.settings ?? {})}::jsonb, ${input.sortOrder ?? 0}, ${input.isActive ?? true})`);
    }
    const { rows } = await tx.execute<{ id: string; key: string; page_key: string; type: string; title: string | null; content: Record<string, unknown>; settings: Record<string, unknown>; sort_order: number }>(sql`
      SELECT id, key, page_key, type, title, content, settings, sort_order FROM cms_sections WHERE id=${id}::uuid`);
    const r = rows[0]!;
    return { id: r.id, key: r.key, pageKey: r.page_key, type: r.type, title: r.title, content: r.content, settings: r.settings, sortOrder: r.sort_order };
  });
}

export async function deleteSection(id: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`DELETE FROM cms_sections WHERE id = ${id}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'Section not found.');
  });
}
