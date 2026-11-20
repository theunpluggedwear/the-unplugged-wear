import { Suspense, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { AccountDataProvider } from '@storefront/lib/account';
import { PaymentConfigProvider } from '@storefront/lib/payment-config';
import { getMyAccount } from '@/server/account';
import { readPaymentConfig } from '@/server/payment-config';

// Private page: kept out of search results.
export const metadata: Metadata = {
  title: 'Checkout | The Unplugged Wear',
  description: 'Secure checkout for The Unplugged Wear.',
  robots: { index: false, follow: true },
};

// Gateway capabilities are static for a deployment, so start the read on the
// server and stream it to both checkout screens with use() (CLN-NXT-006). The
// promise is created here but resolved inside the client provider, so it bails
// a static prerender out the same way getMyAccount() does instead of blocking.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  const config = readPaymentConfig();
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AccountDataProvider data={getMyAccount()}>
        <PaymentConfigProvider config={config}>{children}</PaymentConfigProvider>
      </AccountDataProvider>
    </Suspense>
  );
}
