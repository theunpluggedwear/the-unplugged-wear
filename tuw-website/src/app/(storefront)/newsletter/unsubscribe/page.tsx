import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unsubscribe } from '@tuw/heart/modules/marketing';

export const instant = false;

async function unsubscribeAction(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '').trim();
  if (!token) redirect('/newsletter/unsubscribe?error=missing');
  const result = await unsubscribe(token).catch(() => null);
  if (!result) redirect('/newsletter/unsubscribe?error=invalid');
  redirect(`/newsletter/unsubscribe?done=${encodeURIComponent(result.email)}`);
}

export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string; error?: string }> }) {
  const { token, done, error } = await searchParams;
  const message = done
    ? `${done} has been unsubscribed. You will no longer receive The TUW Dispatch.`
    : error === 'missing'
      ? 'This unsubscribe link is missing its token.'
      : error
        ? 'That unsubscribe link is invalid or has already been used.'
        : null;

  return (
    <main className="flex-1 max-w-xl mx-auto px-4 py-24 text-center">
      <h1 className="tuw-h1 text-store-charcoal">Newsletter</h1>
      {message ? (
        <p className="mt-4 text-sm text-store-text-secondary">{message}</p>
      ) : token ? (
        <form action={unsubscribeAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex items-center h-11 px-6 rounded-full bg-[#111111] text-white text-sm font-medium hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
          >
            Unsubscribe me
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-store-text-secondary">This unsubscribe link is missing its token.</p>
      )}
      <Link href="/" className="mt-6 inline-block text-sm underline">Back to home</Link>
    </main>
  );
}
