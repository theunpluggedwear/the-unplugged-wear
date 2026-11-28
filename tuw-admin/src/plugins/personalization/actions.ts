'use server';

import { z } from 'zod';
import { getDb, withTransaction, sql } from '@tuw/heart/platform/db';
import { AppError } from '@tuw/heart/platform/errors';
import { recordAudit } from '@tuw/heart/platform/audit';
import { qikinkHealth } from '@tuw/heart/integrations/fulfillment';
import { guards } from '@/server/session';
import {
  normalizePreviewSettings,
  publicQikinkMode,
  readPersonalizationSettings,
  type CategoryPreviewSettings,
} from './preview-settings.ts';

const previewTemplateInput = z.object({
  angle: z.string().trim().max(40).default('Front'),
  imagePath: z.string().trim().max(2048).default(''),
  printType: z.number().int().refine((value) => [1, 3, 5, 23].includes(value), 'Use print type 1, 3, 5 or 23'),
  placementCode: z.enum(['fr', 'bk', 'lp', 'rp', 'ls', 'rs']),
  widthInches: z.number().finite().min(0.1).max(100),
  heightInches: z.number().finite().min(0.1).max(100),
});

const previewSettingsInput = z.object({ templates: z.array(previewTemplateInput).max(24) });

const personalizationInput = z.discriminatedUnion('op', [
  z.object({ op: z.literal('load'), categoryIds: z.array(z.string().uuid()).max(500).default([]) }),
  z.object({ op: z.literal('save'), categoryId: z.string().uuid(), settings: previewSettingsInput.nullable() }),
]);

function assertCategoryManage(permissions: readonly string[]): void {
  if (!permissions.includes('category.manage')) throw new AppError('FORBIDDEN', 'You do not have permission to manage categories.');
}

export const personalizationAdminAction = guards.action(
  { permission: 'category.manage', input: personalizationInput },
  async ({ input, ctx }) => {
    assertCategoryManage(ctx.user!.permissions);
    const mode = publicQikinkMode(qikinkHealth());
    if (input.op === 'load') {
      const configs: Record<string, CategoryPreviewSettings> = {};
      if (input.categoryIds.length) {
        const { rows } = await getDb().execute<{ id: string; settings: Record<string, unknown> | null }>(sql`
          SELECT id, settings FROM categories
          WHERE id IN (${sql.join(input.categoryIds.map((id) => sql`${id}::uuid`), sql`, `)}) AND deleted_at IS NULL`);
        for (const row of rows) configs[row.id] = readPersonalizationSettings(row.settings);
      }
      return { configs, mode };
    }
    const next = input.settings === null ? null : normalizePreviewSettings(input.settings);
    await withTransaction(async (tx) => {
      const { rows } = await tx.execute<{ settings: Record<string, unknown> | null }>(sql`
        SELECT settings FROM categories WHERE id = ${input.categoryId}::uuid AND deleted_at IS NULL FOR UPDATE`);
      if (!rows[0]) throw new AppError('NOT_FOUND', 'That category does not exist.');
      if (next) {
        await tx.execute(sql`
          UPDATE categories SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{personalization}', ${JSON.stringify(next)}::jsonb, true), updated_at = now()
          WHERE id = ${input.categoryId}::uuid`);
      } else {
        await tx.execute(sql`
          UPDATE categories SET settings = COALESCE(settings, '{}'::jsonb) - 'personalization', updated_at = now()
          WHERE id = ${input.categoryId}::uuid`);
      }
      await recordAudit(tx, {
        actorId: ctx.user!.id,
        action: 'category.update',
        entity: 'categories',
        entityId: input.categoryId,
        diff: { personalization: { from: readPersonalizationSettings(rows[0].settings), to: next } },
      });
    });
    const { rows } = await getDb().execute<{ settings: Record<string, unknown> | null }>(sql`
      SELECT settings FROM categories WHERE id = ${input.categoryId}::uuid`);
    return { configs: { [input.categoryId]: readPersonalizationSettings(rows[0]?.settings) }, mode };
  },
);
