import { z } from 'zod';

export const qikinkSkuImport = z.object({
  productId: z.string().uuid(),
  rows: z.array(z.object({
    variantId: z.string().uuid(),
    providerSku: z.string().trim().min(1, 'Every row needs a Store SKU').max(100),
    unitCost: z.number().finite().min(0).max(10_000_000).nullable().optional(),
    payload: z.record(z.string().max(50), z.unknown()).default({}),
  })).min(1, 'No rows were matched to variants').max(5000),
});

export type QikinkSkuImportInput = z.infer<typeof qikinkSkuImport>;
