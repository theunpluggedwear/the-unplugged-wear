import React from 'react';
import type { ProductItem } from '@/lib/admin-dto';

export const GENDER_OPTIONS = [
  { value: 'unspecified', label: 'Unspecified' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Unisex', label: 'Unisex' },
  { value: 'Kids', label: 'Kids' },
  { value: 'Boy', label: 'Boy' },
  { value: 'Girl', label: 'Girl' },
];

export const PUBLICATION_OPTIONS: Array<{ value: ProductItem['publicationStatus']; label: string }> = [
  { value: 'published', label: 'Published (Live)' },
  { value: 'draft', label: 'Draft (Hidden)' },
  { value: 'archived', label: 'Archived' },
];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: 'percent', label: 'Percent %' },
  { value: 'fixed', label: 'Fixed ₹' },
];

export const PARTNER_OPTIONS: Array<{ value: ProductItem['partner']; label: string }> = [
  { value: 'Qikink Direct API', label: 'Qikink Direct API' },
  { value: 'Printrove Hub', label: 'Printrove Hub' },
  { value: 'Custom Atelier', label: 'Custom Atelier' },
];

export const pairedFieldGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};

export const flatGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
  padding: 12,
  border: '1px solid var(--tuw-border-subtle)',
  borderRadius: 8,
};

export const attributeChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 28,
  padding: '2px 4px 2px 8px',
  borderRadius: 999,
  border: '1px solid var(--tuw-border-subtle)',
  backgroundColor: 'var(--tuw-bg-canvas)',
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 500,
  color: 'var(--tuw-text-primary)',
};

export const attributeMetaStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--tuw-text-secondary)',
};

export const attributeGroupLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  margin: 0,
  fontSize: 11,
  lineHeight: '16px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--tuw-text-secondary)',
};
