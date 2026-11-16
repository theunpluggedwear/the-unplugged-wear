import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { toPaise } from '../../platform/money/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getFulfillmentPartner } from '../../integrations/fulfillment/index.ts';
import { externalRef } from './provider.ts';
import { postWalletEntry } from './wallet.ts';

// Claims with the print partner (DOC/backend/16 §4) and re-ships for parcels
// that came back. A claim is evidence first: Qikink refuses "wrong item" and
// "missing item" without an unboxing video, and nothing is claimable after the
// provider's window (7 days by default) closes.

export type ClaimTypeValue = 'damaged' | 'misprint' | 'wrong_item' | 'missing_item' | 'size_discrepancy' | 'lost_in_transit';
export type ClaimStatusValue = 'draft' | 'submitted' | 'approved' | 'rejected' | 'resolved';
export type ClaimResolution = 'reprint' | 'wallet_credit' | 'refund' | 'none';

const WINDOW_DEFAULT = 7;
const VIDEO_REQUIRED: ClaimTypeValue[] = ['wrong_item', 'missing_item'];

export interface ClaimRow {
  id: string;
  fulfillmentId: string;
  orderNumber: string;
  type: ClaimTypeValue;
  status: ClaimStatusValue;
  resolution: ClaimResolution | null;
  claimDeadline: string | null;
  evidenceCount: number;
  hasUnboxingVideo: boolean;
  providerTicketRef: string | null;
  customerNote: string | null;
  staffNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  amountPaise: number;
}

const SELECT_CLAIM = sql`
  SELECT c.id, c.fulfillment_order_id, o.order_number, c.type, c.status, c.resolution, c.claim_deadline,
         cardinality(c.evidence_media_ids) AS evidence_count, c.has_unboxing_video, c.provider_ticket_ref,
         c.customer_note, c.staff_note, c.created_at, c.resolved_at, l.amount AS claim_amount
  FROM fulfillment_claims c
  JOIN fulfillment_orders f ON f.id = c.fulfillment_order_id
  JOIN orders o ON o.id = f.order_id
  LEFT JOIN LATERAL (SELECT amount FROM provider_wallet_ledger w
                     WHERE w.fulfillment_order_id = f.id AND w.kind = 'claim_credit'
                     ORDER BY created_at DESC LIMIT 1) l ON true`;

type ClaimSql = {
  id: string; fulfillment_order_id: string; order_number: string; type: ClaimTypeValue; status: ClaimStatusValue;
  resolution: ClaimResolution | null; claim_deadline: string | null; evidence_count: number; has_unboxing_video: boolean;
  provider_ticket_ref: string | null; customer_note: string | null; staff_note: string | null; created_at: string;
  resolved_at: string | null; claim_amount: string | null;
};

const toClaim = (r: ClaimSql): ClaimRow => ({
  id: r.id, fulfillmentId: r.fulfillment_order_id, orderNumber: r.order_number, type: r.type, status: r.status,
  resolution: r.resolution, claimDeadline: r.claim_deadline ? new Date(r.claim_deadline).toISOString() : null,
  evidenceCount: r.evidence_count, hasUnboxingVideo: r.has_unboxing_video, providerTicketRef: r.provider_ticket_ref,
  customerNote: r.customer_note, staffNote: r.staff_note, createdAt: new Date(r.created_at).toISOString(),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
  amountPaise: r.claim_amount ? toPaise(r.claim_amount) : 0,
});

export async function listClaimsFor(fulfillmentId: string): Promise<ClaimRow[]> {
  const { rows } = await getDb().execute<ClaimSql>(sql`${SELECT_CLAIM} WHERE c.fulfillment_order_id = ${fulfillmentId} ORDER BY c.created_at DESC`);
  return rows.map(toClaim);
}

export async function listClaims(input: { status?: ClaimStatusValue | 'open'; limit?: number } = {}): Promise<ClaimRow[]> {
  const where = input.status === 'open'
    ? sql`WHERE c.status IN ('draft','submitted')`
    : input.status ? sql`WHERE c.status = ${input.status}` : sql``;
  const { rows } = await getDb().execute<ClaimSql>(sql`${SELECT_CLAIM} ${where} ORDER BY c.created_at DESC LIMIT ${input.limit ?? 50}`);
  return rows.map(toClaim);
}

/**
 * Open a claim on a delivered parcel. Evidence comes from the customer's
 * return request unless the caller passes media ids explicitly; the unboxing
 * video flag is detected from those media rows.
 */
export async function createClaim(input: {
  fulfillmentId: string; type: ClaimTypeValue; evidenceMediaIds: string[]; hasUnboxingVideo: boolean;
  customerNote?: string; returnId?: string;
}, actorId: string): Promise<ClaimRow> {
  const { rows: [row] } = await getDb().execute<{
    order_id: string; order_number: string; status: string; delivered_at: string | null; claim_window: string | null;
  }>(sql`
    SELECT f.order_id, o.order_number, f.status, f.delivered_at,
           (ip.capabilities->>'claimWindowDays') AS claim_window
    FROM fulfillment_orders f
    JOIN orders o ON o.id = f.order_id
    JOIN integration_providers ip ON ip.id = f.provider_id
    WHERE f.id = ${input.fulfillmentId}`);
  if (!row) throw new AppError('NOT_FOUND', 'That parcel does not exist.');
  if (row.status !== 'delivered' && input.type !== 'lost_in_transit') {
    throw new AppError('RULE_VIOLATION', 'Provider claims open on a delivered parcel. Use "lost in transit" for a parcel that never arrived.');
  }
  const windowDays = row.claim_window ? Number(row.claim_window) : WINDOW_DEFAULT;
  const deadline = row.delivered_at ? new Date(new Date(row.delivered_at).getTime() + windowDays * 86_400_000) : null;

  let media = input.evidenceMediaIds;
  let video = input.hasUnboxingVideo;
  let returnId = input.returnId ?? null;
  if (!media.length || !returnId) {
    const { rows: [ret] } = await getDb().execute<{ id: string; evidence_media_ids: string[]; has_video: boolean }>(sql`
      SELECT r.id, r.evidence_media_ids,
             EXISTS (SELECT 1 FROM media m, unnest(r.evidence_media_ids) AS ev(id)
                     WHERE m.id = ev.id AND m.mime_type LIKE 'video/%') AS has_video
      FROM returns r JOIN orders o ON o.id = r.order_id
      WHERE o.id = ${row.order_id} AND r.status <> 'cancelled'
      ORDER BY r.created_at DESC LIMIT 1`);
    if (ret) {
      if (!media.length) media = ret.evidence_media_ids;
      video = video || ret.has_video;
      returnId ??= ret.id;
    }
  }
  if (!media.length) throw new AppError('VALIDATION_FAILED', 'A claim needs evidence: a photo or video from the customer, or media ids.');
  if (VIDEO_REQUIRED.includes(input.type) && !video) {
    throw new AppError('RULE_VIOLATION', 'This claim type needs the unboxing video — the partner refuses it without one.');
  }
  const id = uuidv7();
  try {
    await getDb().execute(sql`INSERT INTO fulfillment_claims (id, fulfillment_order_id, return_id, type, status,
        claim_deadline, evidence_media_ids, has_unboxing_video, customer_note, created_by)
      VALUES (${id}, ${input.fulfillmentId}, ${returnId}, ${input.type}, 'draft', ${deadline}, ${media}::uuid[], ${video},
              ${input.customerNote?.slice(0, 1000) ?? null}, ${actorId})`);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new AppError('CONFLICT', `An open “${input.type.replace(/_/g, ' ')}” claim already exists for this parcel.`);
    throw error;
  }
  const { rows: [claim] } = await getDb().execute<ClaimSql>(sql`${SELECT_CLAIM} WHERE c.id = ${id}`);
  return toClaim(claim);
}

/** draft → submitted → approved/rejected → resolved (one step per call). */
export async function updateClaim(input: {
  claimId: string; status: Exclude<ClaimStatusValue, 'draft'>; resolution?: ClaimResolution; staffNote?: string;
  providerTicketRef?: string; amountPaise?: number;
}, actorId: string): Promise<ClaimRow> {
  return withTransaction(async (tx) => {
    const { rows: [claim] } = await tx.execute<{
      id: string; status: ClaimStatusValue; type: ClaimTypeValue; fulfillment_order_id: string;
      provider_id: string; has_unboxing_video: boolean; claim_deadline: string | null;
    }>(sql`
      SELECT c.id, c.status, c.type, c.fulfillment_order_id, f.provider_id, c.has_unboxing_video, c.claim_deadline
      FROM fulfillment_claims c JOIN fulfillment_orders f ON f.id = c.fulfillment_order_id
      WHERE c.id = ${input.claimId} FOR UPDATE`);
    if (!claim) throw new AppError('NOT_FOUND', 'That claim does not exist.');
    const allowed: Record<ClaimStatusValue, ClaimStatusValue[]> = {
      draft: ['submitted'], submitted: ['approved', 'rejected'], approved: ['resolved'], rejected: [], resolved: [],
    };
    if (!allowed[claim.status].includes(input.status)) {
      throw new AppError('RULE_VIOLATION', `A ${claim.status} claim cannot become ${input.status}.`);
    }
    if (input.status === 'submitted') {
      if (VIDEO_REQUIRED.includes(claim.type) && !claim.has_unboxing_video) {
        throw new AppError('RULE_VIOLATION', 'Add the unboxing video before submitting this claim.');
      }
      if (claim.claim_deadline && new Date(claim.claim_deadline) < new Date()) {
        throw new AppError('RULE_VIOLATION', `The partner's claim window closed on ${claim.claim_deadline.slice(0, 10)}.`);
      }
    }
    if ((input.status === 'approved' || input.status === 'resolved') && !input.resolution) {
      throw new AppError('VALIDATION_FAILED', 'Choose what the partner agreed to: reprint, wallet credit, refund or nothing.');
    }
    await tx.execute(sql`UPDATE fulfillment_claims SET status = ${input.status},
        resolution = COALESCE(${input.resolution ?? null}, resolution),
        staff_note = COALESCE(${input.staffNote?.slice(0, 1000) ?? null}, staff_note),
        provider_ticket_ref = COALESCE(${input.providerTicketRef?.slice(0, 100) ?? null}, provider_ticket_ref),
        submitted_at = CASE WHEN ${input.status} = 'submitted' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
        resolved_at = CASE WHEN ${input.status} = 'resolved' THEN now() ELSE resolved_at END,
        updated_at = now()
      WHERE id = ${claim.id}`);
    if (input.status === 'resolved' && input.resolution === 'wallet_credit') {
      if (!input.amountPaise || input.amountPaise <= 0) throw new AppError('VALIDATION_FAILED', 'Enter the credit the partner gave (in rupees).');
      await postWalletEntry(tx, {
        providerId: claim.provider_id, kind: 'claim_credit', direction: 'credit', amountPaise: input.amountPaise,
        fulfillmentOrderId: claim.fulfillment_order_id, note: `Claim credit by ${actorId.slice(0, 8)}`, actor: actorId,
      });
    }
    const { rows: [after] } = await tx.execute<ClaimSql>(sql`${SELECT_CLAIM} WHERE c.id = ${claim.id}`);
    return toClaim(after);
  });
}

export interface ReshipOutcome {
  fulfillmentId: string;
  orderNumber: string;
  provider: string;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Send the same parcel again (RTO that came back, or a lost parcel). A re-ship
 * is its own provider order — new row, new reference — because re-using the
 * original reference would be silently ignored by the partner.
 */
export async function reshipFulfillment(input: { fulfillmentId: string }, actorId: string): Promise<ReshipOutcome> {
  const { rows: [src] } = await getDb().execute<{
    id: string; order_id: string; order_number: string; provider_id: string; provider_slug: string; status: string;
    gateway: 'prepaid' | 'cod'; grand_total: string; shipping_address: Record<string, string>;
  }>(sql`
    SELECT f.id, f.order_id, o.order_number, f.provider_id, ip.slug AS provider_slug, f.status,
           f.gateway, o.grand_total, o.shipping_address
    FROM fulfillment_orders f
    JOIN orders o ON o.id = f.order_id
    JOIN integration_providers ip ON ip.id = f.provider_id
    WHERE f.id = ${input.fulfillmentId}`);
  if (!src) throw new AppError('NOT_FOUND', 'That parcel does not exist.');
  if (!['shipped', 'delivery_exception', 'delivered', 'rto_initiated', 'returned'].includes(src.status)) {
    throw new AppError('RULE_VIOLATION', 'Only a dispatched parcel can be re-shipped.');
  }
  const { rows: items } = await getDb().execute<{ order_item_id: string; qty: number; provider_sku: string; provider_payload: Record<string, unknown> }>(sql`
    SELECT order_item_id, qty, provider_sku, provider_payload FROM fulfillment_order_items WHERE fulfillment_order_id = ${src.id}`);

  const newId = uuidv7();
  const ref = await withTransaction(async (tx) => {
    for (let attempt = 1; attempt <= 9; attempt++) {
      const candidate = externalRef(src.order_number, attempt);
      await tx.execute(sql`SAVEPOINT reship_ref`);
      try {
        await tx.execute(sql`INSERT INTO fulfillment_orders (id, order_id, provider_id, external_ref, reason, status, gateway, submit_attempts)
          VALUES (${newId}, ${src.order_id}, ${src.provider_id}, ${candidate}, 'reship', 'pending', 'prepaid', 1)`);
        return candidate;
      } catch (error) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT reship_ref`);
        if ((error as { code?: string }).code !== '23505') throw error;
      }
    }
    throw new AppError('CONFLICT', 'Could not allocate a re-ship reference.');
  });
  for (const item of items) {
    await getDb().execute(sql`INSERT INTO fulfillment_order_items (id, fulfillment_order_id, order_item_id, qty, provider_sku, provider_payload)
      VALUES (${uuidv7()}, ${newId}, ${item.order_item_id}, ${item.qty}, ${item.provider_sku}, ${JSON.stringify(item.provider_payload)}::jsonb)`);
  }
  const partner = getFulfillmentPartner(src.provider_slug);
  const address = src.shipping_address ?? {};
  try {
    const state = await partner.createOrder({
      reference: ref,
      gateway: 'prepaid',
      totalPaise: toPaise(src.grand_total),
      lines: items.map((i) => ({ sku: i.provider_sku, quantity: i.qty, payload: i.provider_payload })),
      shipTo: {
        name: address.fullName ?? 'Customer', line1: address.line1 ?? '', line2: address.line2 ?? null,
        city: address.city ?? '', state: address.state ?? '', postalCode: address.postalCode ?? '',
        phone: address.phone ?? '', country: address.country ?? 'India',
      },
    });
    await getDb().execute(sql`UPDATE fulfillment_orders SET status = ${state.status}, provider_status = ${state.providerStatus},
      provider_order_id = ${state.providerOrderRef}, submitted_at = now(), synced_at = now(), last_error = NULL,
      raw_payload = raw_payload || ${JSON.stringify(state.raw ?? {})}::jsonb, updated_at = now() WHERE id = ${newId}`);
    return { fulfillmentId: newId, orderNumber: src.order_number, provider: src.provider_slug, status: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await getDb().execute(sql`UPDATE fulfillment_orders SET status = 'failed', last_error = ${message.slice(0, 1000)}, synced_at = now() WHERE id = ${newId}`);
    return { fulfillmentId: newId, orderNumber: src.order_number, provider: src.provider_slug, status: 'failed', error: message };
  }
}
