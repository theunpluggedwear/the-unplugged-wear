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

export default function MediaTab(props: SectionProps) {
  const {
    addUrlRow,
    assetCards,
    assetRows,
    dropzone,
    handlePickedFiles,
    mediaCards,
    mediaGalleryCardOpen,
    mediaPresentationCardOpen,
    mediaWide,
    mediaWrapRef,
    panelHeader,
    photoInputRef,
    presentationSection,
    setMediaGalleryCardOpen,
    setMediaPresentationCardOpen,
    stageCarousel,
    stageHeader,
  } = props.vm;
  return (
          <div ref={mediaWrapRef} data-field="images" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: mediaWide ? '9fr 11fr' : '1fr', gap: mediaWide ? 20 : 16, alignItems: 'start' }}>
              <DrawerCard
                title="Gallery & cover"
                description="Ordered storefront photos and the primary cover"
                collapsible
                isOpen={mediaGalleryCardOpen}
                onToggle={setMediaGalleryCardOpen}
              >
                {stageHeader}
                {stageCarousel}
                {panelHeader}
                {mediaCards ? assetCards : assetRows}
                {addUrlRow}
                {dropzone}
              </DrawerCard>
              <DrawerCard
                title="Presentation"
                description="Layout, aspect ratio and storefront visibility"
                collapsible
                isOpen={mediaPresentationCardOpen}
                onToggle={setMediaPresentationCardOpen}
              >
                {presentationSection}
              </DrawerCard>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              aria-label="Upload photos"
              style={{ display: 'none' }}
              onChange={(e) => {
                handlePickedFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
  );
}