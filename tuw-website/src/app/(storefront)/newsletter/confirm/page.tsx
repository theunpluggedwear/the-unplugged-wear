import Link from 'next/link';
import { confirm } from '@tuw/heart/modules/marketing';

export const instant = false;

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
      <main className="flex-1 max-w-xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-store-charcoal">Newsletter</h1>
        <p className="mt-4 text-sm text-store-text-secondary">{message}</p>
        <Link href="/" className="mt-6 inline-block text-sm underline">Back to home</Link>
      </main>
  );
}
