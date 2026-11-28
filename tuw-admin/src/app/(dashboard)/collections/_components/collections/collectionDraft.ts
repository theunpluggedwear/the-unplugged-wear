


import type { CollectionItem, ProductItem } from '@/lib/admin-dto';
import { isValidSlug, isSlugTaken, slugify } from '@tuw/heart/modules/catalog/rules';
import type { SearchableSelectOption } from '@/components/ui';

export type CollectionVisibility = CollectionItem['visibility'];

export interface CollectionDraft {
  name: string;
  slug: string;
  

  slugTouched: boolean;
  season: string;
  visibility: CollectionVisibility;
  
  publishedAt: string;
  description: string;
  productIds: string[];
}

export interface CollectionDraftErrors {
  name?: string;
  slug?: string;
  season?: string;
  publishedAt?: string;
}


const toLocalInput = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function emptyDraft(): CollectionDraft {
  return {
    name: '',
    slug: '',
    slugTouched: false,
    season: 'AW26',
    visibility: 'published',
    publishedAt: '',
    description: '',
    productIds: [],
  };
}




export function draftFromCollection(
  collection: CollectionItem,
  products: ProductItem[],
): CollectionDraft {
  const validProductIds = new Set(products.map((product) => product.id));
  return {
    name: collection.name,
    slug: collection.slug,
    slugTouched: true,
    season: collection.season,
    visibility: collection.visibility,
    publishedAt: toLocalInput(collection.publishedAt),
    description: collection.description,
    productIds: collection.productIds.filter((id) => validProductIds.has(id)),
  };
}


export function withName(draft: CollectionDraft, name: string): CollectionDraft {
  return { ...draft, name, slug: draft.slugTouched ? draft.slug : slugify(name) };
}

export function withSlug(draft: CollectionDraft, slug: string): CollectionDraft {
  return { ...draft, slug, slugTouched: true };
}

export function validateDraft(
  draft: CollectionDraft,
  collections: CollectionItem[],
  excludeId?: string,
): CollectionDraftErrors {
  const errors: CollectionDraftErrors = {};
  const slug = draft.slug.trim();
  if (!draft.name.trim()) errors.name = 'Collection title is required.';
  if (!slug) errors.slug = 'URL slug is required.';
  else if (!isValidSlug(slug)) errors.slug = 'Use lowercase letters, numbers, and single dashes only.';
  else if (isSlugTaken(slug, collections, excludeId)) {
    errors.slug = 'Another collection already uses this slug.';
  }
  if (!draft.season.trim()) errors.season = 'Season is required.';
  if (draft.visibility === 'scheduled' && !draft.publishedAt) errors.publishedAt = 'Choose the drop date.';
  return errors;
}

export function draftToPayload(draft: CollectionDraft): Omit<CollectionItem, 'id' | 'updatedAt'> {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    season: draft.season.trim(),
    visibility: draft.visibility,
    ...(draft.visibility === 'scheduled' && draft.publishedAt ? { publishedAt: new Date(draft.publishedAt).toISOString() } : {}),
    description: draft.description.trim(),
    productIds: [...draft.productIds],
  };
}



export function toProductOptions(products: ProductItem[]): SearchableSelectOption[] {
  return products.map((product) => ({
    value: product.id,
    label: product.name,
    description: product.category,
    meta: `₹${product.price.toFixed(2)}`,
    keywords: `${product.id} ${product.slug} ${product.category}`,
  }));
}
