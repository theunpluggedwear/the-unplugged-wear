import Link from 'next/link';
import { unsubscribe } from '@tuw/heart/modules/marketing';

export const instant = false;

export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message = 'We could not process that request.';
  if (token) {
    try {
      const result = await unsubscribe(token);
      message = `${result.email} has been unsubscribed. You will no longer receive The TUW Dispatch.`;
    } catch {
      message = 'That unsubscribe link is invalid or has already been used.';
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
