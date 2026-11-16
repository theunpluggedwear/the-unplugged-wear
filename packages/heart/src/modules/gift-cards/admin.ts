import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import * as svc from './service.ts';
import type { IssueInput } from './service.ts';

async function hasPermission(userId: string, slug: string): Promise<boolean> {
  const { rows } = await getDb().execute<{ ok: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ${userId}::uuid AND p.slug = ${slug}
    ) AS ok`);
  return rows[0]?.ok === true;
}

async function requirePermission(userId: string): Promise<void> {
  if (!(await hasPermission(userId, 'giftcard.manage'))) throw new AppError('FORBIDDEN', 'Gift-card management requires the giftcard.manage permission.');
}

export async function adminListGiftCards(input: Parameters<typeof svc.listCards>[0], actorId: string) {
  await requirePermission(actorId);
  return svc.listCards(input);
}

export async function adminGetGiftCard(cardId: string, actorId: string) {
  await requirePermission(actorId);
  return svc.getCard(cardId);
}

export async function adminIssueCard(input: IssueInput, actorId: string) {
  await requirePermission(actorId);
  return withTransaction((tx) => svc.issue(tx, { ...input, issuedBy: actorId }));
}

export async function adminAdjustCard(input: { cardId: string; amountPaise: number; direction: 'credit' | 'debit'; note: string; idempotencyKey: string }, actorId: string) {
  await requirePermission(actorId);
  return withTransaction((tx) => svc.adjust(tx, { ...input, actor: actorId }));
}

export async function adminSetStatus(cardId: string, status: 'active' | 'disabled', actorId: string) {
  await requirePermission(actorId);
  return withTransaction((tx) => svc.setStatus(tx, cardId, status, actorId));
}

export async function adminBalance(code: string, _actorId: string) {
  return svc.balance(code);
}