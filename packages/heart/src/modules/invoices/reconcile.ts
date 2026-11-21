import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { findInvoiceProvider } from '../../integrations/invoices/index.ts';
import { QA_DEMO_INVOICE_PROVIDER } from '../../platform/qa-demo-product/index.ts';
import { expirePendingPayment } from '../orders/payment-confirmation.ts';
import { markDocumentStatus, markInvoicePaid } from './service.ts';

type Row = {
  id: string; provider: string; provider_document_id: string; order_id: string;
  amount_paise: string; currency: string;
};

/** Poll provider-hosted invoices. Webhooks are preferred; this is the safety net. */
export async function reconcileInvoiceDocuments(limit = 20): Promise<{ paid: number; expired: number; failed: number }> {
  const { rows } = await getDb().execute<Row>(sql`
    SELECT id, provider, provider_document_id, order_id, amount_paise, currency
    FROM payment_documents
    WHERE status IN ('issued','partially_paid') AND created_at < now() - interval '1 minute'
    ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`);

  let paid = 0, expired = 0, failed = 0;
  for (const doc of rows) {
    if (doc.provider === QA_DEMO_INVOICE_PROVIDER) continue;
    const adapter = findInvoiceProvider(doc.provider);
    if (!adapter?.capabilities.fetch) continue;
    try {
      const remote = await adapter.fetch(doc.provider_document_id);
      if (!remote) { failed += 1; continue; }
      if (remote.status === 'paid') {
        await markInvoicePaid({
          provider: doc.provider,
          providerDocumentId: doc.provider_document_id,
          providerOrderId: remote.providerOrderId,
          providerPaymentId: remote.providerPaymentId,
          status: 'paid',
          paymentStatus: 'captured',
          amountPaise: remote.amountPaise || Number(doc.amount_paise),
          currency: remote.raw && typeof remote.raw === 'object' && 'currency' in remote.raw ? String((remote.raw as { currency: unknown }).currency) : doc.currency,
          raw: remote.raw,
        });
        paid += 1;
      } else if (remote.status === 'expired' || remote.status === 'cancelled') {
        await markDocumentStatus(doc.id, remote.status, remote.providerPaymentId);
        await expirePendingPayment(doc.order_id);
        expired += 1;
      } else {
        await markDocumentStatus(doc.id, remote.status, remote.providerPaymentId);
      }
    } catch {
      failed += 1;
    }
  }
  return { paid, expired, failed };
}
