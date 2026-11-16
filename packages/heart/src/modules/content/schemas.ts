import { z } from 'zod';

export const pageSlug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase slug');

export const savePage = z.object({
  slug: pageSlug,
  title: z.string().trim().min(1).max(255),
  blocks: z.array(z.record(z.unknown())).max(200),
  seo: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const pageRef = z.object({ slug: pageSlug });

export const saveNavigation = z.object({
  navbar: z.record(z.unknown()),
});

export const saveTheme = z.object({
  theme: z.record(z.unknown()),
});

export const listPages = z.object({});
export const getNavigationInput = z.object({});
