import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listPublished, getPostBySlug } from '@tuw/heart/modules/marketing';

export async function generateStaticParams() {
  const { rows } = await listPublished({ perPage: 100 });
  return rows.length ? rows.map((p) => ({ slug: p.slug })) : [{ slug: '__none__' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { post } = await getPostBySlug(slug);
  if (!post) return { title: 'Article Not Found | The Unplugged Wear' };
  return {
    title: `${post.title} | The Unplugged Wear Journal`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

export default async function JournalArticleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { post } = await getPostBySlug(slug);
  if (!post) notFound();
  return children;
}
