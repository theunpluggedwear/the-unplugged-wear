import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Database, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toRupees, toPaise } from '../../platform/money/index.ts';
import { getSettings } from '../settings/index.ts';
import { randomBytes, createHash } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 16;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export interface IssueInput {
  amountPaise: number;
  purchasedOrderItemId?: string | null;
  purchasedUnitNo?: number | null;
  issuedBy?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
}

export interface IssuedCard {
  id: string;
  code: string;
  last4: string;
  expiresAt: string;
  amountPaise: number;
}

export async function issue(tx: Transaction, input: IssueInput): Promise<IssuedCard> {
  const settings = await getSettings(tx);
  const months = Number(settings['gift_card.validity_months'] ?? 6);
  const code = generateCode();
  const codeHash = sha256Hex(code);
  const last4 = code.slice(-4);
  const id = uuidv7();
  const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
  const amount = toRupees(input.amountPaise);
  await tx.execute(sql`INSERT INTO gift_cards (id, code_hash, code_last4, initial_value, balance, expires_at,
        recipient_name, recipient_email, message, purchased_order_item_id, purchased_unit_no, issued_by)
      VALUES (${id}, ${codeHash}, ${last4}, ${amount}, ${amount}, ${expiresAt}::timestamptz,
        ${input.recipientName ?? null}, ${input.recipientEmail ?? null}, ${input.message ?? null},
        ${input.purchasedOrderItemId ?? null}, ${input.purchasedUnitNo ?? null}, ${input.issuedBy ?? null})`);
  await tx.execute(sql`INSERT INTO gift_card_transactions (id, gift_card_id, type, amount, balance_after, actor, note)
      VALUES (${uuidv7()}, ${id}, 'issue', ${amount}, ${amount}, ${input.issuedBy ?? 'system'}, 'Issued')`);
  return { id, code, last4, expiresAt, amountPaise: input.amountPaise };
}

export interface RedeemResult { cardId: string; appliedPaise: number; }

export async function redeem(tx: Transaction, input: { code: string; amountPaise: number; orderId: string; actor?: string }): Promise<RedeemResult> {
  const codeHash = sha256Hex(input.code.trim().toUpperCase());
  const { rows } = await tx.execute<{ id: string; balance: string; status: string; expires_at: string | null }>(sql`
    SELECT id, balance, status, expires_at FROM gift_cards WHERE code_hash = ${codeHash} FOR UPDATE`);
  const card = rows[0];
  if (!card) throw new AppError('RULE_VIOLATION', 'That gift card code is not valid.');
  if (card.status !== 'active') throw new AppError('RULE_VIOLATION', `That gift card is ${card.status}.`);
  if (card.expires_at && new Date(card.expires_at).getTime() <= Date.now()) throw new AppError('RULE_VIOLATION', 'That gift card has expired.');
  const balancePaise = toPaise(card.balance);
  if (balancePaise <= 0) throw new AppError('RULE_VIOLATION', 'That gift card has no balance left.');
  const applied = Math.min(input.amountPaise, balancePaise);
  const newBalancePaise = balancePaise - applied;
  const newBalance = toRupees(newBalancePaise);
  const newStatus = newBalancePaise === 0 ? 'depleted' : 'active';
  await tx.execute(sql`UPDATE gift_cards SET balance = ${newBalance}, status = ${newStatus}, updated_at = now() WHERE id = ${card.id}::uuid`);
  await tx.execute(sql`INSERT INTO gift_card_transactions (id, gift_card_id, type, amount, balance_after, order_id, actor, note)
      VALUES (${uuidv7()}, ${card.id}::uuid, 'redeem', ${toRupees(applied)}, ${newBalance}, ${input.orderId}::uuid, ${input.actor ?? 'system'}, 'Redeemed at checkout')`);
  return { cardId: card.id, appliedPaise: applied };
}

export async function reverseForOrder(tx: Transaction, orderId: string, actor: string): Promise<{ cardId: string; amountPaise: number } | null> {
  const { rows } = await tx.execute<{ id: string; gift_card_id: string; amount: string }>(sql`
    SELECT id, gift_card_id, amount FROM gift_card_transactions
    WHERE order_id = ${orderId}::uuid AND type = 'redeem'`);
  if (!rows.length) return null;
  let total = 0;
  let cardId = rows[0]!.gift_card_id;
  for (const r of rows) {
    const { rows: existing } = await tx.execute(sql`SELECT 1 FROM gift_card_transactions WHERE gift_card_id = ${r.gift_card_id}::uuid AND order_id = ${orderId}::uuid AND type = 'reversal'`);
    if (existing.length) continue;
    const amt = toPaise(r.amount);
    total += amt;
    cardId = r.gift_card_id;
    const { rows: c } = await tx.execute<{ balance: string }>(sql`SELECT balance FROM gift_cards WHERE id = ${r.gift_card_id}::uuid FOR UPDATE`);
    const newBalancePaise = toPaise(c[0]!.balance) + amt;
    await tx.execute(sql`UPDATE gift_cards SET balance = ${toRupees(newBalancePaise)}, status = CASE WHEN status = 'depleted' THEN 'active' ELSE status END, updated_at = now() WHERE id = ${r.gift_card_id}::uuid`);
    await tx.execute(sql`INSERT INTO gift_card_transactions (id, gift_card_id, type, amount, balance_after, order_id, actor, note)
      VALUES (${uuidv7()}, ${r.gift_card_id}::uuid, 'reversal', ${toRupees(amt)}, ${toRupees(newBalancePaise)}, ${orderId}::uuid, ${actor}, 'Order cancelled')`);
  }
  return total ? { cardId, amountPaise: total } : null;
}

export async function adjust(tx: Transaction, input: { cardId: string; amountPaise: number; direction: 'credit' | 'debit'; note: string; idempotencyKey: string; actor: string }): Promise<{ balancePaise: number }> {
  const { rows } = await tx.execute<{ id: string; balance: string; status: string }>(sql`SELECT id, balance, status FROM gift_cards WHERE id = ${input.cardId}::uuid FOR UPDATE`);
  const card = rows[0];
  if (!card) throw new AppError('NOT_FOUND', 'Gift card not found.');
  if (card.status !== 'active') throw new AppError('RULE_VIOLATION', `Cannot adjust a ${card.status} card.`);
  const current = toPaise(card.balance);
  const delta = input.direction === 'credit' ? input.amountPaise : -input.amountPaise;
  const next = current + delta;
  if (next < 0) throw new AppError('RULE_VIOLATION', 'Adjustment would make the balance negative.');
  const newStatus = next === 0 ? 'depleted' : 'active';
  await tx.execute(sql`UPDATE gift_cards SET balance = ${toRupees(next)}, status = ${newStatus}, updated_at = now() WHERE id = ${input.cardId}::uuid`);
  try {
    await tx.execute(sql`INSERT INTO gift_card_transactions (id, gift_card_id, type, amount, balance_after, actor, note, idempotency_key)
      VALUES (${uuidv7()}, ${input.cardId}::uuid, 'adjust', ${toRupees(input.amountPaise)}, ${toRupees(next)}, ${input.actor}, ${input.note}, ${input.idempotencyKey})`);
  } catch (e) {
    const pg = (e as { cause?: { code?: string; constraint?: string } })?.cause ?? e;
    if (pg && (pg as { code?: string }).code === '23505') throw new AppError('CONFLICT', 'That adjustment was already applied.');
    throw e;
  }
  return { balancePaise: next };
}

export async function previewRedeem(code: string, maxPaise: number): Promise<{ last4: string; balancePaise: number; appliedPaise: number; status: string; expiresAt: string | null } | null> {
  const codeHash = sha256Hex(code.trim().toUpperCase());
  const { rows } = await getDb().execute<{ code_last4: string; balance: string; status: string; expires_at: string | null }>(sql`
    SELECT code_last4, balance, status, expires_at FROM gift_cards WHERE code_hash = ${codeHash}`);
  const r = rows[0];
  if (!r) return null;
  if (r.status !== 'active') throw new AppError('RULE_VIOLATION', `That gift card is ${r.status}.`);
  if (r.expires_at && new Date(r.expires_at).getTime() <= Date.now()) throw new AppError('RULE_VIOLATION', 'That gift card has expired.');
  const balancePaise = toPaise(r.balance);
  if (balancePaise <= 0) throw new AppError('RULE_VIOLATION', 'That gift card has no balance left.');
  return { last4: r.code_last4, balancePaise, appliedPaise: Math.min(balancePaise, maxPaise), status: r.status, expiresAt: r.expires_at };
}

export async function balance(code: string): Promise<{ last4: string; balancePaise: number; status: string; expiresAt: string | null } | null> {
  const codeHash = sha256Hex(code.trim().toUpperCase());
  const { rows } = await getDb().execute<{ code_last4: string; balance: string; status: string; expires_at: string | null }>(sql`
    SELECT code_last4, balance, status, expires_at FROM gift_cards WHERE code_hash = ${codeHash}`);
  const r = rows[0];
  if (!r) return null;
  return { last4: r.code_last4, balancePaise: toPaise(r.balance), status: r.status, expiresAt: r.expires_at };
}

export interface CardRow { id: string; codeLast4: string; initialValue: number; balance: number; status: string; expiresAt: string | null; recipientName: string | null; recipientEmail: string | null; purchasedOrderItemId: string | null; issuedBy: string | null; createdAt: string; }

export async function listCards(input: { q?: string; status?: string; page?: number; perPage?: number } = {}): Promise<{ rows: CardRow[]; total: number }> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 20;
  const offset = (page - 1) * perPage;
  const statusFilter = input.status && input.status !== 'all' ? input.status : null;
  const q = input.q?.trim() ? `%${input.q.trim()}%` : null;
  const { rows } = await getDb().execute<{ id: string; code_last4: string; initial_value: string; balance: string; status: string; expires_at: string | null; recipient_name: string | null; recipient_email: string | null; purchased_order_item_id: string | null; issued_by: string | null; created_at: string; total: string }>(sql`
    SELECT id, code_last4, initial_value, balance, status, expires_at, recipient_name, recipient_email, purchased_order_item_id, issued_by, created_at,
           count(*) OVER()::text AS total
    FROM gift_cards
    WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
      AND (${q}::text IS NULL OR code_last4 ILIKE ${q} OR recipient_email ILIKE ${q})
    ORDER BY created_at DESC
    LIMIT ${perPage} OFFSET ${offset}`);
  return {
    rows: rows.map((r) => ({
      id: r.id, codeLast4: r.code_last4, initialValue: toPaise(r.initial_value), balance: toPaise(r.balance), status: r.status,
      expiresAt: r.expires_at, recipientName: r.recipient_name, recipientEmail: r.recipient_email,
      purchasedOrderItemId: r.purchased_order_item_id, issuedBy: r.issued_by, createdAt: r.created_at,
    })),
    total: rows[0] ? Number(rows[0].total) : 0,
  };
}

export async function getCard(cardId: string): Promise<{ card: CardRow; ledger: { id: string; type: string; amount: number; balanceAfter: number; orderId: string | null; actor: string; note: string | null; createdAt: string }[] } | null> {
  const { rows: cards } = await getDb().execute<{ id: string; code_last4: string; initial_value: string; balance: string; status: string; expires_at: string | null; recipient_name: string | null; recipient_email: string | null; purchased_order_item_id: string | null; issued_by: string | null; created_at: string }>(sql`
    SELECT id, code_last4, initial_value, balance, status, expires_at, recipient_name, recipient_email, purchased_order_item_id, issued_by, created_at
    FROM gift_cards WHERE id = ${cardId}::uuid`);
  const c = cards[0];
  if (!c) return null;
  const { rows: ledger } = await getDb().execute<{ id: string; type: string; amount: string; balance_after: string; order_id: string | null; actor: string; note: string | null; created_at: string }>(sql`
    SELECT id, type, amount, balance_after, order_id, actor, note, created_at FROM gift_card_transactions
    WHERE gift_card_id = ${cardId}::uuid ORDER BY created_at, id`);
  return {
    card: { id: c.id, codeLast4: c.code_last4, initialValue: toPaise(c.initial_value), balance: toPaise(c.balance), status: c.status, expiresAt: c.expires_at, recipientName: c.recipient_name, recipientEmail: c.recipient_email, purchasedOrderItemId: c.purchased_order_item_id, issuedBy: c.issued_by, createdAt: c.created_at },
    ledger: ledger.map((l) => ({ id: l.id, type: l.type, amount: toPaise(l.amount), balanceAfter: toPaise(l.balance_after), orderId: l.order_id, actor: l.actor, note: l.note, createdAt: l.created_at })),
  };
}

export async function setStatus(tx: Transaction, cardId: string, status: 'active' | 'disabled', actor: string): Promise<void> {
  const { rowCount } = await tx.execute(sql`UPDATE gift_cards SET status = ${status}, updated_at = now() WHERE id = ${cardId}::uuid`);
  if (!rowCount) throw new AppError('NOT_FOUND', 'Gift card not found.');
}

export async function expireDue(): Promise<{ processed: number }> {
  return withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`UPDATE gift_cards SET status = 'expired', updated_at = now() WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now()`);
    return { processed: rowCount ?? 0 };
  });
}