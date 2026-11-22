import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import * as svc from './service.ts';

async function requirePermission(actorId: string, permission: string): Promise<void> {
  const { rows } = await getDb().execute<{ ok: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ${actorId}::uuid AND p.slug = ${permission}
    ) AS ok`);
  if (rows[0]?.ok !== true) throw new AppError('FORBIDDEN', `${permission} is required.`);
}

export async function adminGetDashboard(actorId: string, range?: svc.DateRangeFilter) {
  await requirePermission(actorId, 'order.view');
  return svc.getDashboardSummary(range);
}

export async function adminGetReport(actorId: string) {
  await requirePermission(actorId, 'report.view');
  return svc.getReportSummary();
}

export async function adminListAbandoned(actorId: string) {
  await requirePermission(actorId, 'order.view');
  return svc.listAbandonedCarts();
}

export async function adminRemindAbandoned(id: string, actorId: string) {
  await requirePermission(actorId, 'order.update_status');
  return svc.markAbandonedReminded(id, actorId);
}
