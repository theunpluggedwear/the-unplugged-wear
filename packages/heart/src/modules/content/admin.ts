import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import * as svc from './service.ts';
import * as media from './media.ts';
import * as designs from './designs.ts';

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

export async function adminGetMobileNav(actorId: string) {
  await requireContentManager(actorId);
  return svc.getStorefrontMobileNav();
}

export async function adminSaveMobileNav(items: svc.MobileNavItem[], actorId: string) {
  await requireContentManager(actorId);
  return svc.saveMobileNav(items, actorId);
}

export async function adminGetTheme(actorId: string) {
  await requireContentManager(actorId);
  return svc.getTheme();
}

export async function adminListFaqs(actorId: string) {
  await requireContentManager(actorId);
  return svc.listAllFaqs();
}

export async function adminSaveFaq(input: Parameters<typeof svc.saveFaq>[0], actorId: string) {
  await requireContentManager(actorId);
  return svc.saveFaq(input, actorId);
}

export async function adminDeleteFaq(id: string, actorId: string) {
  await requireContentManager(actorId);
  return svc.deleteFaq(id);
}

export async function adminListMedia(usage?: Parameters<typeof media.listMedia>[0], actorId?: string) {
  if (actorId) await requireContentManager(actorId);
  return media.listMedia(usage);
}

export async function adminSaveMedia(input: Parameters<typeof media.saveMedia>[0], actorId: string) {
  await requireContentManager(actorId);
  return media.saveMedia(input, actorId);
}

export async function adminDeleteMedia(id: string, actorId: string) {
  await requireContentManager(actorId);
  return media.deleteMedia(id, actorId);
}

export async function adminGetHomeCms(actorId: string) {
  await requireContentManager(actorId);
  return svc.getHomeCmsConfig();
}

export async function adminSaveHomeFeatured(input: svc.HomeFeaturedConfig, actorId: string) {
  await requireContentManager(actorId);
  return svc.saveHomeFeatured(input);
}

export async function adminSaveHomeJournal(input: svc.HomeJournalConfig, actorId: string) {
  await requireContentManager(actorId);
  return svc.saveHomeJournal(input);
}

export async function adminListDesigns(input: Parameters<typeof designs.listDesigns>[0], actorId: string) {
  await requireContentManager(actorId);
  return designs.listDesigns(input);
}

export async function adminSaveDesign(input: Parameters<typeof designs.saveDesign>[0], actorId: string) {
  await requireContentManager(actorId);
  return designs.saveDesign(input, actorId);
}

export async function adminDeleteDesign(id: string, actorId: string) {
  await requireContentManager(actorId);
  return designs.deleteDesign(id);
}
