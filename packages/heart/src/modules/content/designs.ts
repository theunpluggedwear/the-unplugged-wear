import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';

export type DesignCategory = 'print_artwork' | 'embroidery' | 'typography' | 'label_spec';
export type DesignStatus = 'approved' | 'in_review' | 'archived';

export interface DesignAsset {
  id: string;
  name: string;
  category: DesignCategory;
  designer: string | null;
  placement: string | null;
  dimensions: string | null;
  fileFormat: string | null;
  fileSizeBytes: number | null;
  status: DesignStatus;
  mediaId: string | null;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export async function listDesigns(input: { category?: DesignCategory; status?: DesignStatus } = {}): Promise<DesignAsset[]> {
  const { rows } = await getDb().execute<{
    id: string; name: string; category: DesignCategory; designer: string | null; placement: string | null;
    dimensions: string | null; file_format: string | null; file_size_bytes: number | null; status: DesignStatus;
    media_id: string | null; notes: string | null; uploaded_by: string | null; created_at: string;
  }>(sql`SELECT id, name, category, designer, placement, dimensions, file_format, file_size_bytes, status, media_id, notes, uploaded_by, created_at
    FROM design_assets
    WHERE (${input.category ?? null}::text IS NULL OR category = ${input.category ?? null})
      AND (${input.status ?? null}::text IS NULL OR status = ${input.status ?? null})
    ORDER BY created_at DESC`);
  return rows.map((r) => ({
    id: r.id, name: r.name, category: r.category, designer: r.designer, placement: r.placement,
    dimensions: r.dimensions, fileFormat: r.file_format, fileSizeBytes: r.file_size_bytes, status: r.status,
    mediaId: r.media_id, notes: r.notes, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function saveDesign(input: {
  id?: string; name: string; category: DesignCategory; designer?: string | null; placement?: string | null;
  dimensions?: string | null; fileFormat?: string | null; fileSizeBytes?: number | null;
  status?: DesignStatus; mediaId?: string | null; notes?: string | null;
}, actorId: string): Promise<DesignAsset> {
  return withTransaction(async (tx) => {
    const id = input.id ?? uuidv7();
    if (input.id) {
      const { rowCount } = await tx.execute(sql`SELECT 1 FROM design_assets WHERE id = ${input.id}::uuid`);
      if (!rowCount) throw new AppError('NOT_FOUND', 'Design asset not found.');
      await tx.execute(sql`UPDATE design_assets SET name=${input.name}, category=${input.category}, designer=${input.designer ?? null},
        placement=${input.placement ?? null}, dimensions=${input.dimensions ?? null}, file_format=${input.fileFormat ?? null},
        file_size_bytes=${input.fileSizeBytes ?? null}, status=${input.status ?? 'in_review'}, media_id=${input.mediaId ?? null},
        notes=${input.notes ?? null}, updated_at=now() WHERE id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO design_assets (id, name, category, designer, placement, dimensions, file_format, file_size_bytes,
        status, media_id, notes, uploaded_by) VALUES (${id}::uuid, ${input.name}, ${input.category}, ${input.designer ?? null},
        ${input.placement ?? null}, ${input.dimensions ?? null}, ${input.fileFormat ?? null}, ${input.fileSizeBytes ?? null},
        ${input.status ?? 'in_review'}, ${input.mediaId ?? null}, ${input.notes ?? null}, ${actorId}::uuid)`);
    }
    const { rows } = await tx.execute<{
      id: string; name: string; category: DesignCategory; designer: string | null; placement: string | null;
      dimensions: string | null; file_format: string | null; file_size_bytes: number | null; status: DesignStatus;
      media_id: string | null; notes: string | null; uploaded_by: string | null; created_at: string;
    }>(sql`SELECT id, name, category, designer, placement, dimensions, file_format, file_size_bytes, status, media_id, notes, uploaded_by, created_at FROM design_assets WHERE id=${id}::uuid`);
    const r = rows[0]!;
    return {
      id: r.id, name: r.name, category: r.category, designer: r.designer, placement: r.placement,
      dimensions: r.dimensions, fileFormat: r.file_format, fileSizeBytes: r.file_size_bytes, status: r.status,
      mediaId: r.media_id, notes: r.notes, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at).toISOString(),
    };
  });
}

export async function deleteDesign(id: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`DELETE FROM design_assets WHERE id = ${id}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'Design asset not found.');
  });
}
