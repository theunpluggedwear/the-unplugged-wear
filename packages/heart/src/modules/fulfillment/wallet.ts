import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, type Transaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees, toPaise } from '../../platform/money/index.ts';

// Provider prepaid balance (DOC/backend/16 §5). Qikink charges each order
// against a wallet we top up; withdrawals go back to the bank. The ledger is
// append-only — a correction is a new 'adjustment' row, never an edit.

export type WalletKind = 'recharge' | 'order_debit' | 'cancel_credit' | 'claim_credit' | 'cod_remittance' | 'withdrawal' | 'adjustment';
export type WalletDirection = 'debit' | 'credit';

export interface WalletEntryRow {
  id: string;
  providerId: string;
  providerName: string;
  kind: WalletKind;
  direction: WalletDirection;
  amountPaise: number;
  balanceAfterPaise: number | null;
  orderNumber: string | null;
  externalRef: string | null;
  note: string | null;
  actor: string;
  createdAt: string;
}

export interface WalletSummary {
  providerId: string;
  providerSlug: string;
  providerName: string;
  balancePaise: number;
  debited30dPaise: number;
  credited30dPaise: number;
  lastEntryAt: string | null;
}

const signed = (direction: WalletDirection, amountPaise: number) => (direction === 'credit' ? amountPaise : -amountPaise);

export async function walletBalancePaise(providerId: string, db: Transaction | ReturnType<typeof getDb> = getDb()): Promise<number> {
  const { rows: [row] } = await db.execute<{ balance: string | null }>(sql`
    SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS balance
    FROM provider_wallet_ledger WHERE provider_id = ${providerId}`);
  return row?.balance === null || row?.balance === undefined ? 0 : toPaise(row.balance);
}

/**
 * Append one ledger row, computing balance_after from everything before it.
 * `ON CONFLICT DO NOTHING` makes the automatic order-debit and cancel-credit
 * idempotent even when a job is retried.
 */
export async function postWalletEntry(tx: Transaction, entry: {
  providerId: string;
  kind: WalletKind;
  direction: WalletDirection;
  amountPaise: number;
  fulfillmentOrderId?: string | null;
  codRemittanceId?: string | null;
  externalRef?: string | null;
  note?: string | null;
  actor?: string;
}): Promise<boolean> {
  if (!Number.isSafeInteger(entry.amountPaise) || entry.amountPaise <= 0) throw new RangeError('Wallet amount must be positive paise');
  const delta = toRupees(signed(entry.direction, entry.amountPaise));
  const { rowCount } = await tx.execute(sql`
    INSERT INTO provider_wallet_ledger (id, provider_id, kind, direction, amount, balance_after,
      fulfillment_order_id, cod_remittance_id, external_ref, note, actor)
    SELECT ${uuidv7()}, ${entry.providerId}, ${entry.kind}, ${entry.direction}, ${toRupees(entry.amountPaise)},
           COALESCE((SELECT SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END)
                     FROM provider_wallet_ledger l WHERE l.provider_id = ${entry.providerId}), 0) + ${delta}::numeric,
           ${entry.fulfillmentOrderId ?? null}, ${entry.codRemittanceId ?? null}, ${entry.externalRef ?? null},
           ${entry.note?.slice(0, 255) ?? null}, ${entry.actor ?? 'system'}
    ON CONFLICT DO NOTHING`);
  return (rowCount ?? 0) > 0;
}

export async function walletSummaries(): Promise<WalletSummary[]> {
  const { rows } = await getDb().execute<{
    id: string; slug: string; name: string; balance: string | null; debit30: string | null; credit30: string | null; last_at: string | null;
  }>(sql`
    SELECT ip.id, ip.slug, ip.name,
           (SELECT SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END)
              FROM provider_wallet_ledger l WHERE l.provider_id = ip.id) AS balance,
           (SELECT SUM(l.amount) FROM provider_wallet_ledger l
              WHERE l.provider_id = ip.id AND l.direction = 'debit' AND l.created_at > now() - interval '30 days') AS debit30,
           (SELECT SUM(l.amount) FROM provider_wallet_ledger l
              WHERE l.provider_id = ip.id AND l.direction = 'credit' AND l.created_at > now() - interval '30 days') AS credit30,
           (SELECT max(l.created_at) FROM provider_wallet_ledger l WHERE l.provider_id = ip.id) AS last_at
    FROM integration_providers ip
    WHERE ip.category = 'fulfillment' AND ip.is_active
    ORDER BY ip.name`);
  return rows.map((r) => ({
    providerId: r.id, providerSlug: r.slug, providerName: r.name,
    balancePaise: r.balance ? toPaise(r.balance) : 0,
    debited30dPaise: r.debit30 ? toPaise(r.debit30) : 0,
    credited30dPaise: r.credit30 ? toPaise(r.credit30) : 0,
    lastEntryAt: r.last_at ? new Date(r.last_at).toISOString() : null,
  }));
}

export async function listWalletLedger(input: { providerId?: string; limit?: number } = {}): Promise<WalletEntryRow[]> {
  const limit = input.limit ?? 50;
  const { rows } = await getDb().execute<{
    id: string; provider_id: string; provider_name: string; kind: WalletKind; direction: WalletDirection;
    amount: string; balance_after: string | null; order_number: string | null; external_ref: string | null;
    note: string | null; actor: string; created_at: string;
  }>(sql`
    SELECT l.id, l.provider_id, ip.name AS provider_name, l.kind, l.direction, l.amount, l.balance_after,
           o.order_number, l.external_ref, l.note, l.actor, l.created_at
    FROM provider_wallet_ledger l
    JOIN integration_providers ip ON ip.id = l.provider_id
    LEFT JOIN fulfillment_orders f ON f.id = l.fulfillment_order_id
    LEFT JOIN orders o ON o.id = f.order_id
    ${input.providerId ? sql`WHERE l.provider_id = ${input.providerId}` : sql``}
    ORDER BY l.created_at DESC, l.id DESC LIMIT ${limit}`);
  return rows.map((r) => ({
    id: r.id, providerId: r.provider_id, providerName: r.provider_name, kind: r.kind, direction: r.direction,
    amountPaise: toPaise(r.amount), balanceAfterPaise: r.balance_after ? toPaise(r.balance_after) : null,
    orderNumber: r.order_number, externalRef: r.external_ref, note: r.note, actor: r.actor,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
