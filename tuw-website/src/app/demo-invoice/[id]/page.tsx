import React from 'react';
import { notFound } from 'next/navigation';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import * as invoices from '@tuw/heart/modules/invoices';
import { QA_DEMO_INVOICE_PROVIDER } from '@tuw/heart/platform/qa-demo-product';
import { session } from '@/server/session';
import CompleteButton from './CompleteButton';

export const metadata = { title: 'Demo invoice | The Unplugged Wear', robots: { index: false, follow: false } };
export const instant = false;

export default async function DemoInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await session.requireUser(`/demo-invoice/${id}`);
  const doc = await invoices.getDocumentById(id);
  if (!doc || doc.provider !== QA_DEMO_INVOICE_PROVIDER) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main id="main-content" className="flex-1 w-full max-w-xl mx-auto px-4 py-16">
        <section className="rounded-3xl border border-store-card-border bg-white p-8 shadow-xs space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-store-muted">Demo payment sandbox</p>
            <h1 className="mt-2 font-heading text-3xl font-medium text-store-charcoal">No real payment will be collected.</h1>
          </div>
          <dl className="space-y-2 text-sm text-store-text-secondary">
            <div className="flex justify-between"><dt>Order</dt><dd className="text-store-charcoal">{doc.orderNumber}</dd></div>
            <div className="flex justify-between"><dt>Amount</dt><dd className="text-store-charcoal">₹{(doc.amountPaise / 100).toFixed(2)}</dd></div>
            <div className="flex justify-between"><dt>Status</dt><dd className="text-store-charcoal capitalize">{doc.status}</dd></div>
          </dl>
          <p className="text-sm text-store-text-secondary leading-relaxed">
            This local invoice exists only to test checkout, payment confirmation and receipts.
            Nothing will be printed or shipped, and no Razorpay payment exists for this order.
          </p>
          {doc.status === 'paid' ? (
            <p role="status" className="text-sm font-medium text-store-charcoal">Demo payment already completed.</p>
          ) : (
            <CompleteButton documentId={doc.id} orderNumber={doc.orderNumber} />
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
