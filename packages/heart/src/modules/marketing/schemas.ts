import { z } from 'zod';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase slug');
const date = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date');

export const savePost = z.object({
  id: z.string().uuid().optional(),
  slug,
  title: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().max(255).optional(),
  excerpt: z.string().trim().max(500).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid(),
  coverMediaId: z.string().uuid().nullable().optional(),
  ogMediaId: z.string().uuid().nullable().optional(),
  content: z.array(z.record(z.unknown())).max(300),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  isFeatured: z.boolean().default(false),
  publishedAt: date.nullable().optional(),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  canonicalUrl: z.string().trim().max(2048).optional(),
  noindex: z.boolean().default(false),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
});

export const postRef = z.object({ id: z.string().uuid() });
export const slugRef = z.object({ slug });
export const listInput = z.object({
  status: z.enum(['all', 'draft', 'scheduled', 'published', 'archived']).default('all'),
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
});
export const publicListInput = z.object({
  category: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(12),
});
