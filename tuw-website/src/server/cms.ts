import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CMS_TAGS, FAQ_TAG, getHomeCmsConfig, getNavigation, getPage, listGeneralFaqs, listProductFaqs, type CmsPage, type Faq, type GeneralFaqGroup, type HomeCmsConfig } from '@tuw/heart/modules/content';
import { BLOG_TAG, listPublished, listPublishedByIds, getPostBySlug, type PostDetail, type PostSummary } from '@tuw/heart/modules/marketing';

export type { CmsPage };

export async function cmsHomeConfig(): Promise<HomeCmsConfig> {
  'use cache';
  cacheTag(CMS_TAGS.home);
  cacheLife('hours');
  return getHomeCmsConfig();
}

export async function cmsHomePosts(config: HomeCmsConfig['journal']): Promise<PostSummary[]> {
  'use cache';
  cacheTag(CMS_TAGS.home);
  cacheTag(BLOG_TAG);
  cacheLife('hours');
  if (config.mode === 'featured') {
    const chosen = await listPublishedByIds(config.postIds);
    if (chosen.length) return chosen.slice(0, config.count);
  }
  const latest = await listPublished({ category: config.categorySlug ?? undefined, perPage: config.count });
  return latest.rows;
}

export async function cmsPage(slug: string): Promise<CmsPage | null> {
  'use cache';
  cacheTag(CMS_TAGS.pages);
  cacheLife('hours');
  return getPage(slug);
}

export async function cmsNavigation(): Promise<Record<string, unknown>> {
  'use cache';
  cacheTag(CMS_TAGS.nav);
  cacheLife('hours');
  return getNavigation();
}

export async function cmsPosts(input: { category?: string; page?: number; perPage?: number } = {}): Promise<{ rows: PostSummary[]; total: number }> {
  'use cache';
  cacheTag(BLOG_TAG);
  cacheLife('hours');
  return listPublished(input);
}

export async function cmsPost(slug: string): Promise<{ post: PostDetail | null; redirectTo: string | null }> {
  'use cache';
  cacheTag(BLOG_TAG);
  cacheLife('hours');
  return getPostBySlug(slug);
}

export async function cmsGeneralFaqs(): Promise<GeneralFaqGroup[]> {
  'use cache';
  cacheTag(FAQ_TAG);
  cacheLife('hours');
  return listGeneralFaqs();
}

export async function cmsProductFaqs(productId: string, categoryId?: string | null): Promise<Faq[]> {
  'use cache';
  cacheTag(FAQ_TAG);
  cacheLife('hours');
  return listProductFaqs(productId, categoryId);
}
