import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import * as svc from './service.ts';

async function requireContentManager(actorId: string): Promise<void> {
  const { rows } = await getDb().execute<{ ok: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ${actorId}::uuid AND p.slug = 'content.manage'
    ) AS ok`);
  if (rows[0]?.ok !== true) throw new AppError('FORBIDDEN', 'Content management requires the content.manage permission.');
}

export async function adminListPosts(input: Parameters<typeof svc.listPosts>[0], actorId: string) {
  await requireContentManager(actorId);
  return svc.listPosts(input);
}

export async function adminSavePost(input: svc.SavePostInput, actorId: string) {
  await requireContentManager(actorId);
  return svc.savePost(input, actorId);
}

export async function adminGetPost(slug: string, actorId: string) {
  await requireContentManager(actorId);
  return svc.getPostBySlug(slug, false);
}

export async function adminJournalMeta(actorId: string) {
  await requireContentManager(actorId);
  const [categories, authors, tags] = await Promise.all([svc.listCategories(), svc.listAuthors(), svc.listTags()]);
  return { categories, authors, tags };
}
