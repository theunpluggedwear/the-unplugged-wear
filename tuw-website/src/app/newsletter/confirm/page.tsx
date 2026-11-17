import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import { confirm } from '@tuw/heart/modules/marketing';

export default async function NewsletterConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message = 'We could not confirm that subscription.';
  if (token) {
    try {
      const result = await confirm(token);
      message = `You're subscribed, ${result.email}. Thank you.`;
    } catch {
      message = 'That confirmation link is invalid or has already been used.';
    }
  }
  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main className="flex-1 max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-store-charcoal">Newsletter</h1>
        <p className="mt-4 text-sm text-store-text-secondary">{message}</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">Back to home</Link>
      </main>
      <Footer />
    </div>
  );
}
