import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CMS_TAGS, FAQ_TAG, getHomeSections, getNavigation, getPage, listGeneralFaqs, listProductFaqs, type CmsPage, type CmsSection, type Faq, type GeneralFaqGroup } from '@tuw/heart/modules/content';
import { BLOG_TAG, listPublished, getPostBySlug, type PostDetail, type PostSummary } from '@tuw/heart/modules/marketing';

export type { CmsPage, CmsSection };

export async function cmsHomeSections(): Promise<CmsSection[]> {
  'use cache';
  cacheTag(CMS_TAGS.home);
  cacheLife('hours');
  return getHomeSections();
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
