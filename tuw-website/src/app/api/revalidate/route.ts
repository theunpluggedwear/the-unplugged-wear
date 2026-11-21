import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { PRODUCTS_TAG, REVIEWS_TAG } from '@tuw/heart/modules/catalog';
import { CMS_TAGS, FAQ_TAG } from '@tuw/heart/modules/content';
import { BLOG_TAG } from '@tuw/heart/modules/marketing';
import { SETTINGS_TAG } from '@tuw/heart/modules/settings';
import { NAV_TAG } from '@/server/nav';
import { guards } from '@/server/session';

// Admin → storefront cache refresh (route-handlers skill). Secret-protected;
// only known tags. This allow-list is built from the very same constants the
// storefront readers pass to `cacheTag(...)`, and `Object.values(CMS_TAGS)`
// means a new CMS section is accepted here as soon as it is emitted — the
// endpoint and its emitters can no longer drift apart. Settings and products
// change prices shown to shoppers, so they expire at once ({ expire: 0 }: the
// next request re-reads instead of being served one stale page); content tags
// use 'max'.
const TAGS = [
  SETTINGS_TAG,
  PRODUCTS_TAG,
  NAV_TAG,
  FAQ_TAG,
  REVIEWS_TAG,
  BLOG_TAG,
  ...Object.values(CMS_TAGS),
];
const ALLOWED: ReadonlySet<string> = new Set(TAGS);
const IMMEDIATE: ReadonlySet<string> = new Set([SETTINGS_TAG, PRODUCTS_TAG]);

export const POST = guards.route(
  {
    secret: { header: 'x-revalidate-secret', env: 'REVALIDATE_SECRET' },
    input: z.object({
      tags: z
        .array(z.string().refine((tag) => ALLOWED.has(tag), { message: `Unknown cache tag (allowed: ${TAGS.join(', ')})` }))
        .min(1)
        .max(TAGS.length),
    }),
  },
  async ({ input }) => {
    const tags = [...new Set(input.tags)];
    for (const tag of tags) revalidateTag(tag, IMMEDIATE.has(tag) ? { expire: 0 } : 'max');
    return { revalidated: tags };
  },
);
