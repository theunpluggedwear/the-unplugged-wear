import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees, toPaise } from '../../platform/money/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { postWalletEntry } from './wallet.ts';

// COD money coming back (DOC/backend/16 §5). The courier collects cash, the
// provider pays it to our bank or wallet in one transfer; each transfer is a
// row and every parcel it settles points at it, so "which COD orders are still
// unremitted?" is a query, not a spreadsheet.

export interface RemittanceRow {
  id: string;
  providerName: string;
  transferRef: string;
  amountPaise: number;
  feesPaise: number;
  remittedTo: 'wallet' | 'bank';
  remittedAt: string;
  parcels: number;
  unallocatedPaise: number;
}

export interface RemittanceInput {
  transferRef: string;
  amountPaise: number;
  feesPaise: number;
  remittedTo: 'wallet' | 'bank';
  remittedAt: string;
  fulfillmentIds: string[];
}

async function codProviderId(): Promise<string> {
  const { rows: [row] } = await getDb().execute<{ id: string }>(sql`
    SELECT id FROM integration_providers
    WHERE category = 'fulfillment' AND is_active AND (capabilities->>'cod')::boolean
    ORDER BY name LIMIT 1`);
  if (!row) throw new AppError('RULE_VIOLATION', 'No active fulfilment partner handles cash on delivery.');
  return row.id;
}

export async function recordCodRemittance(input: RemittanceInput, actor: string): Promise<RemittanceRow> {
  if (input.feesPaise > input.amountPaise) throw new AppError('VALIDATION_FAILED', 'The fee cannot be larger than the transfer.');
  const providerId = await codProviderId();
  return withTransaction(async (tx) => {
    const id = uuidv7();
    try {
      await tx.execute(sql`INSERT INTO provider_cod_remittances (id, provider_id, transfer_ref, amount, fees, remitted_to, remitted_at)
        VALUES (${id}, ${providerId}, ${input.transferRef}, ${toRupees(input.amountPaise)}, ${toRupees(input.feesPaise)}, ${input.remittedTo}, ${input.remittedAt})`);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError('CONFLICT', `Transfer ${input.transferRef} is already recorded.`);
      }
      throw error;
    }
    // Parcels named by the operator, or the oldest still-unsettled ones.
    const { rows: parcels } = input.fulfillmentIds.length
      ? await tx.execute<{ id: string; cod_amount: string }>(sql`
          SELECT id, cod_amount FROM fulfillment_orders
          WHERE id IN (${sql.join(input.fulfillmentIds.map((fid) => sql`${fid}::uuid`), sql`, `)})
            AND provider_id = ${providerId} AND gateway = 'cod' AND status = 'delivered' AND cod_remittance_id IS NULL
          FOR UPDATE`)
      : await tx.execute<{ id: string; cod_amount: string }>(sql`
          SELECT id, cod_amount FROM fulfillment_orders
          WHERE provider_id = ${providerId} AND gateway = 'cod' AND status = 'delivered' AND cod_remittance_id IS NULL
          ORDER BY delivered_at NULLS LAST, created_at LIMIT 200 FOR UPDATE`);
    const picked: string[] = [];
    let allocated = 0;
    for (const parcel of parcels) {
      const amount = toPaise(parcel.cod_amount ?? '0');
      if (input.fulfillmentIds.length === 0 && allocated + amount > input.amountPaise) continue;
      picked.push(parcel.id);
      allocated += amount;
    }
    if (input.fulfillmentIds.length && picked.length !== input.fulfillmentIds.length) {
      throw new AppError('RULE_VIOLATION', 'Every parcel must be delivered COD and not already remitted.');
    }
    if (picked.length) {
      await tx.execute(sql`UPDATE fulfillment_orders SET cod_remittance_id = ${id}, updated_at = now()
        WHERE id IN (${sql.join(picked.map((fid) => sql`${fid}::uuid`), sql`, `)})`);
    }
    if (input.remittedTo === 'wallet') {
      await postWalletEntry(tx, {
        providerId, kind: 'cod_remittance', direction: 'credit', amountPaise: input.amountPaise - input.feesPaise,
        codRemittanceId: id, externalRef: input.transferRef, note: `COD transfer ${input.transferRef}`, actor,
      });
    }
    const { rows: [provider] } = await tx.execute<{ name: string }>(sql`SELECT name FROM integration_providers WHERE id = ${providerId}`);
    return {
      id, providerName: provider?.name ?? 'Partner', transferRef: input.transferRef,
      amountPaise: input.amountPaise, feesPaise: input.feesPaise, remittedTo: input.remittedTo,
      remittedAt: new Date(input.remittedAt).toISOString(), parcels: picked.length,
      unallocatedPaise: Math.max(0, input.amountPaise - allocated),
    };
  });
}

export async function listCodRemittances(limit = 50): Promise<RemittanceRow[]> {
  const { rows } = await getDb().execute<{
    id: string; provider_name: string; transfer_ref: string; amount: string; fees: string;
    remitted_to: 'wallet' | 'bank'; remitted_at: string; parcels: number; allocated: string | null;
  }>(sql`
    SELECT r.id, ip.name AS provider_name, r.transfer_ref, r.amount, r.fees, r.remitted_to, r.remitted_at,
           (SELECT count(*)::int FROM fulfillment_orders f WHERE f.cod_remittance_id = r.id) AS parcels,
           (SELECT SUM(f.cod_amount) FROM fulfillment_orders f WHERE f.cod_remittance_id = r.id) AS allocated
    FROM provider_cod_remittances r
    JOIN integration_providers ip ON ip.id = r.provider_id
    ORDER BY r.remitted_at DESC, r.created_at DESC LIMIT ${limit}`);
  return rows.map((r) => ({
    id: r.id, providerName: r.provider_name, transferRef: r.transfer_ref,
    amountPaise: toPaise(r.amount), feesPaise: toPaise(r.fees), remittedTo: r.remitted_to,
    remittedAt: new Date(r.remitted_at).toISOString(), parcels: r.parcels,
    unallocatedPaise: Math.max(0, toPaise(r.amount) - (r.allocated ? toPaise(r.allocated) : 0)),
  }));
}

/** Delivered COD parcels nobody has paid us for yet. */
export async function pendingCodParcels(limit = 50): Promise<{ id: string; orderNumber: string; codPaise: number; deliveredAt: string | null }[]> {
  const { rows } = await getDb().execute<{ id: string; order_number: string; cod_amount: string; delivered_at: string | null }>(sql`
    SELECT f.id, o.order_number, f.cod_amount, f.delivered_at
    FROM fulfillment_orders f JOIN orders o ON o.id = f.order_id
    WHERE f.gateway = 'cod' AND f.status = 'delivered' AND f.cod_remittance_id IS NULL
    ORDER BY f.delivered_at NULLS LAST, f.created_at LIMIT ${limit}`);
  return rows.map((r) => ({ id: r.id, orderNumber: r.order_number, codPaise: toPaise(r.cod_amount), deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null }));
}
