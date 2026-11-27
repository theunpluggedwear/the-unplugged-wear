import Link from 'next/link';
import { redirect } from 'next/navigation';
import { confirm } from '@tuw/heart/modules/marketing';

export const instant = false;

async function confirmAction(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '').trim();
  if (!token) redirect('/newsletter/confirm?error=missing');
  const result = await confirm(token).catch(() => null);
  if (!result) redirect('/newsletter/confirm?error=invalid');
  redirect(`/newsletter/confirm?confirmed=${encodeURIComponent(result.email)}`);
}

export default async function NewsletterConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string; confirmed?: string; error?: string }> }) {
  const { token, confirmed, error } = await searchParams;
  const message = confirmed
    ? `You're subscribed, ${confirmed}. Thank you.`
    : error === 'missing'
      ? 'This confirmation link is missing its token.'
      : error
        ? 'That confirmation link is invalid or has already been used.'
        : null;

  return (
    <main className="flex-1 max-w-xl mx-auto px-4 py-24 text-center">
      <h1 className="tuw-h1 text-store-charcoal">Newsletter</h1>
      {message ? (
        <p className="mt-4 text-sm text-store-text-secondary">{message}</p>
      ) : token ? (
        <form action={confirmAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex items-center h-11 px-6 rounded-full bg-[#111111] text-white text-sm font-medium hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
          >
            Confirm subscription
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-store-text-secondary">This confirmation link is missing its token.</p>
      )}
      <Link href="/" className="mt-6 inline-block text-sm underline">Back to home</Link>
    </main>
  );
}
