import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';

export const BLOG_TAG = 'blog';

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  categoryName: string | null;
  authorName: string;
  coverImageUrl: string | null;
}

export interface PostDetail extends PostSummary {
  subtitle: string | null;
  categoryId: string | null;
  authorId: string;
  coverMediaId: string | null;
  ogMediaId: string | null;
  content: Record<string, unknown>[];
  authorRole: string | null;
  tags: { id: string; name: string; slug: string }[];
  tagIds: string[];
  isFeatured: boolean;
  version: number;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
}

function textFromContent(content: Record<string, unknown>[]): string {
  const parts: string[] = [];
  for (const block of content) {
    for (const key of ['text', 'body', 'content', 'quote', 'heading']) {
      const value = block[key];
      if (typeof value === 'string') parts.push(value);
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function mediaIdsFromContent(content: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const block of content) {
    for (const key of ['mediaId', 'imageId']) {
      const value = block[key];
      if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) ids.add(value);
    }
  }
  return [...ids];
}

const POST_COLUMNS = sql`b.id, b.slug, b.title, b.excerpt, b.status, b.published_at, b.updated_at,
       bc.name AS category_name, ba.name AS author_name, m.url AS cover_image_url`;

type Row = Record<string, unknown>;

function toSummary(r: Row): PostSummary {
  return {
    id: String(r.id), slug: String(r.slug), title: String(r.title), excerpt: r.excerpt ? String(r.excerpt) : null,
    status: String(r.status), publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
    categoryName: r.category_name ? String(r.category_name) : null,
    authorName: String(r.author_name),
    coverImageUrl: r.cover_image_url ? String(r.cover_image_url) : null,
  };
}

async function toDetail(r: Row, db = getDb()): Promise<PostDetail> {
  const { rows: tags } = await db.execute<{ id: string; name: string; slug: string }>(sql`
    SELECT t.id, t.name, t.slug FROM blog_tags t
    JOIN blog_post_tags pt ON pt.tag_id = t.id WHERE pt.blog_id = ${r.id}::uuid`);
  return {
    ...toSummary(r),
    subtitle: r.subtitle ? String(r.subtitle) : null,
    categoryId: r.category_id ? String(r.category_id) : null,
    authorId: String(r.author_id),
    coverMediaId: r.cover_media_id ? String(r.cover_media_id) : null,
    ogMediaId: r.og_media_id ? String(r.og_media_id) : null,
    content: (r.content as Record<string, unknown>[]) ?? [],
    authorRole: r.author_role ? String(r.author_role) : null,
    tags,
    tagIds: tags.map((t) => t.id),
    isFeatured: Boolean(r.is_featured),
    version: Number(r.version ?? 1),
    seoTitle: r.seo_title ? String(r.seo_title) : null,
    seoDescription: r.seo_description ? String(r.seo_description) : null,
    canonicalUrl: r.canonical_url ? String(r.canonical_url) : null,
    noindex: Boolean(r.noindex),
  };
}

export async function listPosts(input: { status?: string; q?: string; page?: number; perPage?: number } = {}): Promise<{ rows: PostSummary[]; total: number }> {
  const status = input.status && input.status !== 'all' ? input.status : null;
  const q = input.q?.trim() ? `%${input.q.trim()}%` : null;
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 20;
  const { rows } = await getDb().execute<Row & { total: string }>(sql`
    SELECT ${POST_COLUMNS}, count(*) OVER()::text AS total
    FROM blogs b
    LEFT JOIN blog_categories bc ON bc.id = b.category_id
    JOIN blog_authors ba ON ba.id = b.author_id
    LEFT JOIN media m ON m.id = b.cover_media_id
    WHERE (${status}::text IS NULL OR b.status = ${status}) AND (${q}::text IS NULL OR b.title ILIKE ${q})
    ORDER BY b.updated_at DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`);
  return { rows: rows.map(toSummary), total: rows[0] ? Number(rows[0].total) : 0 };
}

export async function listPublished(input: { category?: string; page?: number; perPage?: number } = {}): Promise<{ rows: PostSummary[]; total: number }> {
  const category = input.category?.trim() || null;
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 12;
  const { rows } = await getDb().execute<Row & { total: string }>(sql`
    SELECT ${POST_COLUMNS}, count(*) OVER()::text AS total
    FROM blogs b
    LEFT JOIN blog_categories bc ON bc.id = b.category_id
    JOIN blog_authors ba ON ba.id = b.author_id
    LEFT JOIN media m ON m.id = b.cover_media_id
    WHERE b.status = 'published' AND b.published_at <= now()
      AND (${category}::text IS NULL OR bc.slug = ${category})
    ORDER BY b.published_at DESC, b.id DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`);
  return { rows: rows.map(toSummary), total: rows[0] ? Number(rows[0].total) : 0 };
}

export async function listPublishedByIds(ids: string[]): Promise<PostSummary[]> {
  const clean = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!clean.length) return [];
  const { rows } = await getDb().execute<Row & { ord: number }>(sql`
    SELECT ${POST_COLUMNS}, x.ord
    FROM unnest(${clean}::uuid[]) WITH ORDINALITY AS x(id, ord)
    JOIN blogs b ON b.id = x.id
    LEFT JOIN blog_categories bc ON bc.id = b.category_id
    JOIN blog_authors ba ON ba.id = b.author_id
    LEFT JOIN media m ON m.id = b.cover_media_id
    WHERE b.status = 'published' AND b.published_at <= now()
    ORDER BY x.ord`);
  return rows.map(toSummary);
}

export async function getPostBySlug(slug: string, publishedOnly = true): Promise<{ post: PostDetail | null; redirectTo: string | null }> {
  const db = getDb();
  const { rows } = await db.execute<Row>(sql`
    SELECT b.*, bc.name AS category_name, ba.name AS author_name, ba.role_title AS author_role
    FROM blogs b LEFT JOIN blog_categories bc ON bc.id = b.category_id
    JOIN blog_authors ba ON ba.id = b.author_id
    WHERE b.slug = ${slug} ${publishedOnly ? sql`AND b.status = 'published' AND b.published_at <= now()` : sql``}`);
  const r = rows[0];
  if (!r) {
    if (!publishedOnly) return { post: null, redirectTo: null };
    const { rows: hist } = await db.execute<{ blog_id: string }>(sql`
      SELECT h.blog_id FROM blog_slug_history h JOIN blogs b ON b.id = h.blog_id
      WHERE h.slug = ${slug} AND b.status = 'published'`);
    return { post: null, redirectTo: hist[0] ? (await db.execute<{ slug: string }>(sql`SELECT slug FROM blogs WHERE id = ${hist[0].blog_id}::uuid`)).rows[0]?.slug ?? null : null };
  }
  return { post: await toDetail(r, db), redirectTo: null };
}

export async function getPostById(id: string): Promise<PostDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDb();
  const { rows } = await db.execute<Row>(sql`
    SELECT b.*, bc.name AS category_name, ba.name AS author_name, ba.role_title AS author_role
    FROM blogs b LEFT JOIN blog_categories bc ON bc.id = b.category_id
    JOIN blog_authors ba ON ba.id = b.author_id
    WHERE b.id = ${id}::uuid`);
  const r = rows[0];
  return r ? toDetail(r, db) : null;
}

export interface SavePostInput {
  id?: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  categoryId?: string | null;
  authorId: string;
  coverMediaId?: string | null;
  ogMediaId?: string | null;
  content: Record<string, unknown>[];
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  isFeatured?: boolean;
  publishedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  tagIds?: string[];
}

export async function savePost(input: SavePostInput, actorId: string): Promise<PostDetail> {
  if ((input.status === 'scheduled' || input.status === 'published') && !input.publishedAt) {
    throw new AppError('VALIDATION_FAILED', 'Choose a publish date for scheduled or published posts.');
  }
  await withTransaction(async (tx) => {
    const { rows: existing } = await tx.execute<{ id: string; slug: string; version: number }>(sql`
      SELECT id, slug, version FROM blogs WHERE id = ${input.id ? sql`${input.id}::uuid` : sql`NULL`} OR slug = ${input.slug} LIMIT 1`);
    const current = existing[0];
    if (input.id && current && current.id !== input.id) throw new AppError('CONFLICT', 'That id belongs to another post.');
    const { rows: slugClash } = await tx.execute<{ slug: string }>(sql`SELECT slug FROM blog_slug_history WHERE slug = ${input.slug} ${current ? sql`AND blog_id <> ${current.id}::uuid` : sql``}`);
    if (slugClash.length) throw new AppError('CONFLICT', 'That slug was used by another post.');
    if (current && current.slug !== input.slug && current.slug) {
      await tx.execute(sql`INSERT INTO blog_slug_history (slug, blog_id) VALUES (${current.slug}, ${current.id}::uuid) ON CONFLICT (slug) DO NOTHING`);
    }
    const id = current?.id ?? uuidv7();
    const contentText = textFromContent(input.content);
    const minutes = Math.max(1, Math.ceil(contentText.split(/\s+/).length / 200));
    const version = (current?.version ?? 0) + 1;
    if (current) {
      await tx.execute(sql`UPDATE blogs SET slug=${input.slug}, title=${input.title}, subtitle=${input.subtitle ?? null}, excerpt=${input.excerpt ?? null},
        category_id=${input.categoryId ?? null}, author_id=${input.authorId}::uuid, cover_media_id=${input.coverMediaId ?? null}, og_media_id=${input.ogMediaId ?? null},
        content=${JSON.stringify(input.content)}::jsonb, content_text=${contentText}, reading_time_minutes=${minutes}, status=${input.status},
        is_featured=${input.isFeatured ?? false}, published_at=${input.publishedAt ?? null}, seo_title=${input.seoTitle ?? null},
        seo_description=${input.seoDescription ?? null}, canonical_url=${input.canonicalUrl ?? null}, noindex=${input.noindex ?? false},
        version=${version}, updated_by=${actorId}::uuid, updated_at=now() WHERE id=${id}::uuid`);
      await tx.execute(sql`DELETE FROM blog_post_tags WHERE blog_id=${id}::uuid`);
      await tx.execute(sql`DELETE FROM blog_post_media WHERE blog_id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO blogs (id, slug, title, subtitle, excerpt, category_id, author_id, cover_media_id, og_media_id,
        content, content_text, reading_time_minutes, status, is_featured, published_at, seo_title, seo_description, canonical_url, noindex,
        version, created_by, updated_by, created_at, updated_at)
        VALUES (${id}::uuid, ${input.slug}, ${input.title}, ${input.subtitle ?? null}, ${input.excerpt ?? null}, ${input.categoryId ?? null},
        ${input.authorId}::uuid, ${input.coverMediaId ?? null}, ${input.ogMediaId ?? null}, ${JSON.stringify(input.content)}::jsonb,
        ${contentText}, ${minutes}, ${input.status}, ${input.isFeatured ?? false}, ${input.publishedAt ?? null}, ${input.seoTitle ?? null},
        ${input.seoDescription ?? null}, ${input.canonicalUrl ?? null}, ${input.noindex ?? false}, ${version}, ${actorId}::uuid, ${actorId}::uuid, now(), now())`);
    }
    for (const tagId of input.tagIds ?? []) {
      await tx.execute(sql`INSERT INTO blog_post_tags (blog_id, tag_id) VALUES (${id}::uuid, ${tagId}::uuid) ON CONFLICT DO NOTHING`);
    }
    let order = 0;
    for (const mediaId of mediaIdsFromContent(input.content)) {
      await tx.execute(sql`INSERT INTO blog_post_media (blog_id, media_id, sort_order) VALUES (${id}::uuid, ${mediaId}::uuid, ${order}) ON CONFLICT DO NOTHING`);
      order += 1;
    }
    const { rows: rev } = await tx.execute<{ n: number }>(sql`SELECT COALESCE(MAX(revision_no),0)::int AS n FROM blog_revisions WHERE blog_id=${id}::uuid`);
    await tx.execute(sql`INSERT INTO blog_revisions (id, blog_id, revision_no, title, snapshot, created_by)
      VALUES (${uuidv7()}, ${id}::uuid, ${rev[0]!.n + 1}, ${input.title}, ${JSON.stringify(input)}::jsonb, ${actorId}::uuid)`);
    return id;
  });
  // Read after the transaction commits so the new row is visible to the pool.
  return (await getPostBySlug(input.slug, false)).post!;
}

export async function listCategories(): Promise<{ id: string; name: string; slug: string }[]> {
  const { rows } = await getDb().execute<{ id: string; name: string; slug: string }>(sql`SELECT id, name, slug FROM blog_categories WHERE is_active ORDER BY sort_order, name`);
  return rows;
}

export async function listAuthors(): Promise<{ id: string; name: string; roleTitle: string | null }[]> {
  const { rows } = await getDb().execute<{ id: string; name: string; role_title: string | null }>(sql`SELECT id, name, role_title FROM blog_authors WHERE is_active ORDER BY name`);
  return rows.map((r) => ({ id: r.id, name: r.name, roleTitle: r.role_title }));
}

export async function listTags(): Promise<{ id: string; name: string; slug: string }[]> {
  const { rows } = await getDb().execute<{ id: string; name: string; slug: string }>(sql`SELECT id, name, slug FROM blog_tags ORDER BY name`);
  return rows;
}

export async function listRevisions(blogId: string): Promise<{ id: string; revisionNo: number; title: string; createdAt: string; contentText: string }[]> {
  const { rows } = await getDb().execute<{ id: string; revision_no: number; title: string; created_at: string; snapshot: SavePostInput }>(sql`
    SELECT id, revision_no, title, created_at, snapshot FROM blog_revisions WHERE blog_id=${blogId}::uuid ORDER BY revision_no DESC`);
  return rows.map((r) => ({
    id: r.id, revisionNo: r.revision_no, title: r.title,
    createdAt: new Date(r.created_at).toISOString(),
    contentText: textFromContent(r.snapshot?.content ?? []),
  }));
}

export async function getRevisionSnapshot(blogId: string, revisionId: string): Promise<SavePostInput> {
  const { rows } = await getDb().execute<{ snapshot: SavePostInput }>(sql`
    SELECT snapshot FROM blog_revisions WHERE id=${revisionId}::uuid AND blog_id=${blogId}::uuid`);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Revision not found.');
  return rows[0].snapshot;
}

/** Restores a snapshot as a new draft version; the live published post is untouched. */
export async function restoreRevision(blogId: string, revisionId: string, actorId: string): Promise<PostDetail> {
  const current = await getPostById(blogId);
  if (!current) throw new AppError('NOT_FOUND', 'Post not found.');
  const snapshot = await getRevisionSnapshot(blogId, revisionId);
  return savePost({
    ...snapshot,
    id: blogId,
    slug: current.slug,
    authorId: current.authorId,
    status: 'draft',
    publishedAt: null,
  }, actorId);
}
