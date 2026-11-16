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

export async function adminListPages(actorId: string) {
  await requireContentManager(actorId);
  return svc.listPages();
}

export async function adminSavePage(input: Parameters<typeof svc.savePage>[0], actorId: string) {
  await requireContentManager(actorId);
  return svc.savePage(input, actorId);
}

export async function adminGetNavigation(actorId: string) {
  await requireContentManager(actorId);
  return svc.getNavigation();
}

export async function adminSaveNavigation(navbar: Record<string, unknown>, actorId: string) {
  await requireContentManager(actorId);
  return svc.saveNavigation(navbar, actorId);
}

export async function adminGetTheme(actorId: string) {
  await requireContentManager(actorId);
  return svc.getTheme();
}
