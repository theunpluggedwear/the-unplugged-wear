import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';

export const MEDIA_TAG = 'media';

export type MediaUsage = 'product' | 'section' | 'blog' | 'design';

export interface MediaItem {
  id: string;
  url: string;
  filename: string | null;
  sizeBytes: number | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  usage: MediaUsage;
  uploadedBy: string | null;
  createdAt: string;
}

export async function listMedia(usage?: MediaUsage): Promise<MediaItem[]> {
  const { rows } = await getDb().execute<{
    id: string; url: string; filename: string | null; size_bytes: number | null; alt: string | null;
    width: number | null; height: number | null; mime_type: string | null; usage: MediaUsage;
    uploaded_by: string | null; created_at: string;
  }>(sql`SELECT id, url, filename, size_bytes, alt, width, height, mime_type, usage, uploaded_by, created_at
        FROM media ${usage ? sql`WHERE usage = ${usage}` : sql``} ORDER BY created_at DESC`);
  return rows.map((r) => ({
    id: r.id, url: r.url, filename: r.filename, sizeBytes: r.size_bytes, alt: r.alt,
    width: r.width, height: r.height, mimeType: r.mime_type, usage: r.usage,
    uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface SaveMediaInput {
  id?: string;
  url: string;
  filename?: string | null;
  sizeBytes?: number | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  usage: MediaUsage;
}

export async function saveMedia(input: SaveMediaInput, actorId: string): Promise<MediaItem> {
  if (!/^(https:\/\/|\/)/.test(input.url)) throw new AppError('VALIDATION_FAILED', 'Media URL must be an https URL or a local path.');
  return withTransaction(async (tx) => {
    const id = input.id ?? uuidv7();
    if (input.id) {
      const { rows } = await tx.execute<{ id: string }>(sql`SELECT id FROM media WHERE id = ${input.id}::uuid`);
      if (!rows.length) throw new AppError('NOT_FOUND', 'Media item not found.');
      await tx.execute(sql`UPDATE media SET url=${input.url}, filename=${input.filename ?? null}, size_bytes=${input.sizeBytes ?? null},
        alt=${input.alt ?? null}, width=${input.width ?? null}, height=${input.height ?? null}, mime_type=${input.mimeType ?? null},
        usage=${input.usage}, updated_at=now() WHERE id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO media (id, url, filename, size_bytes, alt, width, height, mime_type, usage, uploaded_by)
        VALUES (${id}::uuid, ${input.url}, ${input.filename ?? null}, ${input.sizeBytes ?? null}, ${input.alt ?? null},
          ${input.width ?? null}, ${input.height ?? null}, ${input.mimeType ?? null}, ${input.usage}, ${actorId}::uuid)`);
    }
    const { rows } = await tx.execute<{ id: string; url: string; filename: string | null; size_bytes: number | null; alt: string | null; width: number | null; height: number | null; mime_type: string | null; usage: MediaUsage; uploaded_by: string | null; created_at: string }>(sql`
      SELECT id, url, filename, size_bytes, alt, width, height, mime_type, usage, uploaded_by, created_at FROM media WHERE id=${id}::uuid`);
    const r = rows[0]!;
    return { id: r.id, url: r.url, filename: r.filename, sizeBytes: r.size_bytes, alt: r.alt, width: r.width, height: r.height, mimeType: r.mime_type, usage: r.usage, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at).toISOString() };
  });
}

export async function deleteMedia(id: string, actorId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rows: refs } = await tx.execute<{ source: string }>(sql`
      SELECT 'blogs.cover' AS source FROM blogs WHERE cover_media_id = ${id}::uuid
      UNION ALL SELECT 'blogs.og' FROM blogs WHERE og_media_id = ${id}::uuid
      UNION ALL SELECT 'blog_post_media' FROM blog_post_media WHERE media_id = ${id}::uuid
      UNION ALL SELECT 'design_assets' FROM design_assets WHERE media_id = ${id}::uuid
      LIMIT 1`);
    if (refs.length) throw new AppError('RULE_VIOLATION', `This asset is still used by ${refs[0]!.source} and cannot be deleted.`);
    const { rowCount } = await tx.execute(sql`DELETE FROM media WHERE id = ${id}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'Media item not found.');
  });
}
