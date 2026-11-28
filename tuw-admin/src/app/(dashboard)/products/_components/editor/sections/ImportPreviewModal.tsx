'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Filter, Search, Edit3, Trash2, CheckCircle2, Eye, AlertTriangle, LayoutGrid, List, Tag, ChevronDown, Download, Archive, GripVertical, Upload, Images, Focus, Library, RotateCcw, X } from 'lucide-react';
import { StatCard, ContentCard, SurfaceCard, UpliftSurface, Button, Badge, IconButton, Input, Drawer, Modal, Pagination, FilterPills, PageHeader, ViewToggle, DropdownMenu, Checkbox, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, MediaFrame, FormTextarea, Tabs, Stepper, Switch, DrawerSection, DrawerCard, SearchableSelect, Disclosure, Carousel, LinkButton, ImageWithFallback } from '@/components/ui';
import type { LibraryAttribute, SizeChart } from '@tuw/heart/modules/catalog';
import { attributeDisplayLabel, normalizeAttributeDisplayType, parseCompareAtPrice, slugify, UNCATEGORIZED_CATEGORY } from '@tuw/heart/modules/catalog/rules';
import { resolveVariants, variantStockTotal, buildVariantSku, deriveVariantPrice, recomputeVariants, minFromPrice, pruneAdjustments, roundPrice, hasPriceSpread, adjustmentKey } from '@tuw/heart/modules/catalog/variants';
import { groupImportRows, isValidHsnCode, parseQikinkListing } from '@tuw/heart/modules/catalog/planner';
import type { ImportProductGroup } from '@tuw/heart/modules/catalog/planner';
import type { ProductItem, ProductVariant, ProductAttribute, PhotoSettings, ProductDiscount, ProductGender, StockMovement } from '@/lib/admin-dto';
import { GENDER_OPTIONS, PUBLICATION_OPTIONS, DISCOUNT_TYPE_OPTIONS, PARTNER_OPTIONS, pairedFieldGrid, flatGroupStyle, attributeChipStyle, attributeMetaStyle, attributeGroupLabelStyle } from './constants';
import type { SectionProps } from './types';

export default function ImportPreviewModal(props: SectionProps) {
  const {
    applyImport,
    importPreview,
    importVariantTotal,
    importing,
    setImportPreview,
  } = props.vm;
  return (
      <Modal
        isOpen={importPreview !== null}
        onClose={() => setImportPreview(null)}
        title={`Import Preview — ${importPreview?.fileName ?? ''}`}
        subtitle={
          importPreview
            ? `${importPreview.groups.length} product${
                importPreview.groups.length === 1 ? '' : 's'
              } · ${importVariantTotal} variant${
                importVariantTotal === 1 ? '' : 's'
              } · ${importPreview.errors.length} issue${
                importPreview.errors.length === 1 ? '' : 's'
              }. Valid groups stage as drafts.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" size="md" type="button" onClick={() => setImportPreview(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              disabled={!importPreview || importPreview.groups.length === 0 || importing}
              onClick={applyImport}
            >
              {importing ? 'Importing… ' : 'Stage '}{importPreview?.groups.length ?? 0} Product
              {(importPreview?.groups.length ?? 0) === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {importPreview && importPreview.groups.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', marginBottom: 6 }}>
                Ready to stage ({importPreview.groups.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                {importPreview.groups.slice(0, 20).map((group, i) => {
                  const fromPrice =
                    group.variants.length > 0
                      ? Math.min(...group.variants.map((variant) => variant.costPaise)) / 100
                      : 0;
                  return (
                    <div key={i} style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {group.name} · {group.variants.length} variant
                      {group.variants.length === 1 ? '' : 's'} · partner cost from ₹{fromPrice.toLocaleString()}
                      {group.styleCode ? ` · ${group.styleCode}` : ''}
                      {group.gender ? ` · ${group.gender}` : ''}
                    </div>
                  );
                })}
                {importPreview.groups.length > 20 ? (
                  <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                    …and {importPreview.groups.length - 20} more
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                Base Price is treated as the partner’s cost. Drafts get a draft retail price (cost × 2.5, rounded up to ₹_99, minimum ₹299) that you can change before publishing.
              </div>
              {!importPreview.hasCategoryColumn ? (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                  No Category column found — these drafts stage as {UNCATEGORIZED_CATEGORY}. Assign
                  categories from the catalog before publishing.
                </div>
              ) : null}
            </div>
          ) : null}
          {importPreview && importPreview.errors.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-text-error, #C91818)', marginBottom: 6 }}>
                Issues ({importPreview.errors.length}) — rows are rejected; group conflicts keep the
                first value
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                {importPreview.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                    Row {e.row}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {importPreview && importPreview.groups.length === 0 && importPreview.errors.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
              No rows found.
            </div>
          ) : null}
        </div>
      </Modal>
  );
}