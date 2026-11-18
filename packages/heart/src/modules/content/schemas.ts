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

export const mediaUsage = z.enum(['product', 'section', 'blog', 'design']);
export const listMedia = z.object({ usage: mediaUsage.optional() });
export const saveMedia = z.object({
  id: z.string().uuid().optional(),
  url: z.string().trim().min(1).max(2048),
  filename: z.string().trim().max(255).nullable().optional(),
  sizeBytes: z.number().int().min(1).nullable().optional(),
  alt: z.string().trim().max(255).nullable().optional(),
  width: z.number().int().min(1).nullable().optional(),
  height: z.number().int().min(1).nullable().optional(),
  mimeType: z.string().trim().max(100).nullable().optional(),
  usage: mediaUsage,
});
export const mediaRef = z.object({ id: z.string().uuid() });

export const homeCount = z.union([
  z.literal(3), z.literal(6), z.literal(9), z.literal(12), z.literal(15),
]);
export const homeMode = z.enum(['featured', 'latest']);
export const saveHomeFeatured = z.object({
  mode: homeMode,
  count: homeCount,
  productIds: z.array(z.string().trim().min(1).max(100)).max(15).default([]),
});
export const saveHomeJournal = z.object({
  mode: homeMode,
  count: homeCount,
  postIds: z.array(z.string().uuid()).max(15).default([]),
  categorySlug: z.string().trim().max(100).nullable().optional(),
});
export const getHomeCms = z.object({});

export const designCategory = z.enum(['print_artwork', 'embroidery', 'typography', 'label_spec']);
export const designStatus = z.enum(['approved', 'in_review', 'archived']);
export const listDesigns = z.object({ category: designCategory.optional(), status: designStatus.optional() });
export const saveDesign = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  category: designCategory,
  designer: z.string().trim().max(150).nullable().optional(),
  placement: z.string().trim().max(100).nullable().optional(),
  dimensions: z.string().trim().max(50).nullable().optional(),
  fileFormat: z.string().trim().max(30).nullable().optional(),
  fileSizeBytes: z.number().int().min(1).max(26214400).nullable().optional(),
  status: designStatus.default('in_review'),
  mediaId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export const designRef = z.object({ id: z.string().uuid() });
