import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cmsPost } from '@/server/cms';

export const instant = false;

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { post, redirectTo } = await cmsPost(slug);
  if (redirectTo) redirect(`/journal/${redirectTo}`);
  if (!post) notFound();

  return (
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
        <Link href="/journal" className="text-sm text-store-muted hover:underline">← Journal</Link>
        <p className="mt-8 text-xs uppercase tracking-widest text-store-muted">{post.categoryName ?? 'Journal'}</p>
        <h1 className="tuw-h1 mt-2 text-store-charcoal">{post.title}</h1>
        {post.subtitle && <p className="mt-2 text-lg text-store-text-secondary">{post.subtitle}</p>}
        <p className="mt-4 text-xs text-store-muted">By {post.authorName} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-IN') : ''}</p>

        <article className="mt-10 space-y-6 text-store-charcoal">
          {post.content.map((block, i) => {
            const text = typeof block.text === 'string' ? block.text : typeof block.body === 'string' ? block.body : '';
            if (!text) return null;
            if (block.type === 'heading' || block.type === 'h2') return <h2 key={i} className="tuw-h2 text-store-charcoal">{text}</h2>;
            return <p key={i} className="leading-relaxed">{text}</p>;
          })}
          {post.content.length === 0 && <p className="text-store-text-secondary">This story has no published content yet.</p>}
        </article>

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 text-xs text-store-muted">
            {post.tags.map((t) => <span key={t.id} className="rounded-full border px-3 py-1">#{t.name}</span>)}
          </div>
        )}
      </main>
  );
}
