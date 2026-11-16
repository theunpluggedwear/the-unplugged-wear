import Link from 'next/link';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import { cmsPosts } from '@/server/cms';

export default async function JournalPage() {
  const { rows } = await cmsPosts({ perPage: 50 });
  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-16">
        <p className="text-xs uppercase tracking-widest text-store-muted">Journal</p>
        <h1 className="mt-2 text-4xl font-semibold text-store-charcoal">Stories from the studio</h1>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {rows.map((post) => (
            <Link key={post.id} href={`/journal/${post.slug}`} className="group rounded-2xl border border-store-card-border bg-store-card p-6 hover:border-store-charcoal transition-colors">
              <p className="text-xs text-store-muted">{post.categoryName ?? 'Journal'}</p>
              <h2 className="mt-2 text-xl font-medium text-store-charcoal group-hover:underline">{post.title}</h2>
              {post.excerpt && <p className="mt-2 text-sm text-store-text-secondary">{post.excerpt}</p>}
              <p className="mt-4 text-xs text-store-muted">By {post.authorName}</p>
            </Link>
          ))}
          {rows.length === 0 && <p className="text-sm text-store-text-secondary">No published stories yet.</p>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
