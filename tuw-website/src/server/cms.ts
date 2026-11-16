import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CMS_TAGS, getHomeSections, getNavigation, getPage, type CmsPage, type CmsSection } from '@tuw/heart/modules/content';

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
