import 'server-only';
import { notFound } from 'next/navigation';
import * as content from '@tuw/heart/modules/content';
import * as marketing from '@tuw/heart/modules/marketing';
import type { BlogAuthor, BlogCategory, BlogContent, BlogDraft, BlogMediaAsset, BlogTag } from '@/lib/blog';
import { slugify } from '@/lib/blog';
import { session } from './session';

function draftFromPost(post: marketing.PostDetail): BlogDraft {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    subtitle: post.subtitle ?? undefined,
    excerpt: post.excerpt ?? undefined,
    categoryId: post.categoryId ?? undefined,
    authorId: post.authorId,
    coverMediaId: post.coverMediaId ?? undefined,
    ogMediaId: post.ogMediaId ?? undefined,
    content: post.content as BlogContent,
    contentSchemaVersion: 1,
    status: post.status as BlogDraft['status'],
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt ?? undefined,
    tagIds: post.tagIds,
    seoTitle: post.seoTitle ?? undefined,
    seoDescription: post.seoDescription ?? undefined,
    canonicalUrl: post.canonicalUrl ?? undefined,
    noindex: post.noindex,
  };
}

export interface BlogEditorData {
  post: BlogDraft | null;
  meta: {
    categories: BlogCategory[];
    authors: BlogAuthor[];
    tags: BlogTag[];
  };
  media: BlogMediaAsset[];
  revisions: {
    id: string;
    revisionNo: number;
    title: string;
    createdAt: string;
    contentText: string;
  }[];
  canManage: boolean;
}

export async function loadBlogEditorData(postId?: string): Promise<BlogEditorData> {
  const claims = await session.requireStaff('content.manage', '/content/journal');
  const [meta, media] = await Promise.all([
    marketing.adminJournalMeta(claims.sub),
    content.adminListMedia('blog', claims.sub),
  ]);
  const post = postId ? await marketing.adminGetPostById(postId, claims.sub) : null;
  if (postId && !post) notFound();
  const revisions = post ? await marketing.adminListRevisions(post.id, claims.sub) : [];

  const categories: BlogCategory[] = meta.categories.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, sortOrder: 0, isActive: true,
  }));
  const authors: BlogAuthor[] = meta.authors.map((a) => ({
    id: a.id, name: a.name, slug: slugify(a.name), roleTitle: a.roleTitle ?? undefined, isActive: true,
  }));
  const blogMedia: BlogMediaAsset[] = media.map((m) => ({
    id: m.id,
    url: m.url,
    alt: m.alt ?? '',
    usage: 'blog',
    uploadedBy: m.uploadedBy ?? undefined,
    uploadedAt: m.createdAt,
  }));

  return {
    post: post ? draftFromPost(post) : null,
    meta: { categories, authors, tags: meta.tags },
    media: blogMedia,
    revisions: revisions.map((r) => ({
      id: r.id, revisionNo: r.revisionNo, title: r.title, createdAt: r.createdAt, contentText: r.contentText,
    })),
    canManage: true,
  };
}
