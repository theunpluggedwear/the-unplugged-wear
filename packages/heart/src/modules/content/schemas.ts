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

export const faqScope = z.enum(['general', 'product', 'category']);
export const saveFaq = z.object({
  id: z.string().uuid().optional(),
  scope: faqScope,
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  groupLabel: z.string().trim().max(100).optional(),
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(1),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  isPublished: z.boolean().default(false),
}).refine((v) => {
  if (v.scope === 'general') return !v.productId && !v.categoryId;
  if (v.scope === 'product') return Boolean(v.productId) && !v.categoryId;
  return Boolean(v.categoryId) && !v.productId;
}, { message: 'Scope must match exactly one target', path: ['scope'] });

export const faqRef = z.object({ id: z.string().uuid() });
export const faqList = z.object({});
export const publicFaqs = z.object({
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});
