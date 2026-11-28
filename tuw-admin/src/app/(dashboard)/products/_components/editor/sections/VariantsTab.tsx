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
import { cellAdjustment, cellPriceBreakdown } from '../productEditorUtils';
import type { SectionProps } from './types';

export default function VariantsTab(props: SectionProps) {
  const {
    addVariant,
    adjustmentDrafts,
    clearAdjustmentDraft,
    clearPriceDraft,
    editingProduct,
    formAdjustments,
    formAttributes,
    formPrice,
    formVariants,
    priceDrafts,
    removeVariant,
    setPriceDrafts,
    setVariantsMatrixCardOpen,
    setVariantsPricingCardOpen,
    setVariantsStockCardOpen,
    stockMovements,
    touchVariant,
    updateVariant,
    variantLowest,
    variantSpread,
    variantsMatrixCardOpen,
    variantsPricingCardOpen,
    variantsStockCardOpen,
    writeAdjustment,
  } = props.vm;
  return (
          <div data-field="variants" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DrawerCard
              title="Price adjustments"
              description="Value upcharges added on top of the base price"
              collapsible
              isOpen={variantsPricingCardOpen}
              onToggle={setVariantsPricingCardOpen}
              badge={
                Object.keys(formAdjustments).length > 0 ? (
                  <Badge variant="info">{Object.keys(formAdjustments).length}</Badge>
                ) : undefined
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {['Color', 'Size'].map((attrName) => {
                  const attr = formAttributes.find((a) => a.name === attrName);
                  if (!attr || attr.values.length === 0) return null;
                  return (
                    <div key={attrName} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--tuw-text-secondary, #5D6772)',
                        }}
                      >
                        {attrName}
                      </div>
                      {
}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 8 }}>
                        {attr.values.map((value) => {
                          const key = adjustmentKey(attrName, value);
                          const committed = formAdjustments[key];
                          const draft = adjustmentDrafts[key];
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ flex: 1, fontSize: 13, color: 'var(--tuw-text-primary, #262626)' }}>
                                {value}
                              </span>
                              <div style={{ width: 110, flexShrink: 0 }}>
                                <Input
                                  aria-label={`${attrName} ${value} price adjustment`}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={draft !== undefined ? draft : committed !== undefined ? committed.toFixed(2) : ''}
                                  onChange={(e) => writeAdjustment(key, e.target.value)}
                                  onBlur={() => clearAdjustmentDraft(key)}
                                  style={{ height: 32, textAlign: 'right' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', margin: 0, lineHeight: 1.5 }}>
                  Upcharges only. Clearing a field — or removing the value — drops its adjustment.
                </p>
              </div>
            </DrawerCard>
            <DrawerCard
              title="Variant matrix"
              description="Color × size combinations with SKU, price and stock"
              collapsible
              isOpen={variantsMatrixCardOpen}
              onToggle={setVariantsMatrixCardOpen}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {variantSpread && variantLowest !== null && (
                    <Badge
                      size="sm"
                      variant="neutral"
                      className="tuw-tabular-nums"
                      title="Lowest variant price — the storefront lists this as “From”"
                    >
                      From ₹{variantLowest.toFixed(2)}
                    </Badge>
                  )}
                  <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addVariant}>
                    Add Variant
                  </Button>
                </div>
              }
            >
              <span style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                {formVariants.length} variants · {variantStockTotal(formVariants)} units in stock
              </span>
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead style={{ padding: '12px 16px' }}>Color</TableHead>
                  <TableHead style={{ padding: '12px 16px' }}>Size</TableHead>
                  <TableHead style={{ padding: '12px 16px' }}>SKU</TableHead>
                  {
}
                  <TableHead style={{ padding: '12px 95px 12px 16px', textAlign: 'right' }}>Price</TableHead>
                  <TableHead style={{ padding: '12px 16px' }}>Stock</TableHead>
                  <TableHead style={{ padding: '12px 16px', width: 48 }}><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formVariants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell style={{ padding: '10px 16px', fontSize: 14, color: 'var(--tuw-text-primary, #262626)' }}>
                      {v.id.startsWith('tmp-') ? (
                        <Input
                          aria-label="Variant color"
                          placeholder={v.color === '' ? 'Color' : undefined}
                          
                          autoFocus={v.color === '' && v.size === ''}
                          value={v.color}
                          onChange={(e) => touchVariant(v.id, { color: e.target.value })}
                          style={{ height: 36 }}
                        />
                      ) : (
                        v.color
                      )}
                    </TableCell>
                    <TableCell style={{ padding: '10px 16px', fontSize: 14, color: 'var(--tuw-text-primary, #262626)' }}>
                      {v.id.startsWith('tmp-') ? (
                        <Input
                          aria-label="Variant size"
                          placeholder={v.size === '' ? 'Size' : undefined}
                          value={v.size}
                          onChange={(e) => touchVariant(v.id, { size: e.target.value })}
                          style={{ height: 36 }}
                        />
                      ) : (
                        v.size
                      )}
                    </TableCell>
                    <TableCell style={{ padding: '10px 16px' }}>
                      <Input
                        aria-label={`SKU for ${v.color} ${v.size}`}
                        value={v.sku}
                        onChange={(e) => updateVariant(v.id, { sku: e.target.value })}
                        style={{ height: 36 }}
                      />
                    </TableCell>
                    <TableCell style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Input
                            aria-label={`Price for ${v.color} ${v.size}`}
                            type="text"
                            inputMode="decimal"
                            value={priceDrafts[v.id] !== undefined ? priceDrafts[v.id] : v.price.toFixed(2)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              
                              
                              if (!/^\d*\.?\d*$/.test(raw)) return;
                              setPriceDrafts((prev) => ({ ...prev, [v.id]: raw }));
                              const n = parseFloat(raw);
                              
                              
                              if (!isNaN(n) && n >= 0) updateVariant(v.id, { price: roundPrice(n), priceOverridden: true });
                            }}
                            onBlur={() => clearPriceDraft(v.id)}
                            style={{ height: 36, textAlign: 'right' }}
                          />
                        </div>
                        {



}
                        <div
                          style={{
                            width: 56,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {!v.priceOverridden &&
                            (() => {
                              const adjSum = cellAdjustment(formAdjustments, v.color, v.size);
                              if (adjSum <= 0) return null;
                              return (
                                <span
                                  title={cellPriceBreakdown(formAdjustments, formPrice, v.color, v.size, v.price)}
                                  className="tuw-tabular-nums"
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--tuw-text-secondary, #5D6772)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  +{adjSum.toFixed(2)}
                                </span>
                              );
                            })()}
                          {v.priceOverridden && (
                            <button
                              type="button"
                              aria-label={`Reset ${v.color} ${v.size} price to derived`}
                              title={`Pinned override — reset to derived ₹${deriveVariantPrice(
                                parseFloat(formPrice) || 0,
                                formAdjustments,
                                v.color,
                                v.size,
                              ).toFixed(2)}`}
                              onClick={() =>
                                updateVariant(v.id, {
                                  price: deriveVariantPrice(parseFloat(formPrice) || 0, formAdjustments, v.color, v.size),
                                  priceOverridden: false,
                                })
                              }
                              className="tuw-primary-hover"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 24,
                                height: 24,
                                padding: 0,
                                borderRadius: 6,
                                color: 'var(--tuw-action-primary, #7539FF)',
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ padding: '10px 16px' }}>
                      <Stepper
                        ariaLabel={`Stock for ${v.color} ${v.size}`}
                        value={v.stock}
                        editableValue
                        onChange={(n) => updateVariant(v.id, { stock: n })}
                      />
                    </TableCell>
                    <TableCell style={{ padding: '10px 16px', width: 48 }}>
                      <UpliftSurface active width={28} height={28} className="tuw-danger-hover" style={{ color: 'var(--tuw-text-secondary, #5D6772)' }}>
                        <button
                          type="button"
                          aria-label={`Remove variant ${v.color} ${v.size}`}
                          onClick={() => removeVariant(v.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </UpliftSurface>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </DrawerCard>
            <DrawerCard
              title={`Stock history (${editingProduct ? stockMovements.filter((m) => m.productId === editingProduct.id).length : 0})`}
              description="Ledger of stock changes — every save that moves units appends here"
              collapsible
              isOpen={variantsStockCardOpen}
              onToggle={setVariantsStockCardOpen}
            >
              {editingProduct && stockMovements.some((m) => m.productId === editingProduct.id) ? (
                <Table>
                  <TableHeader>
                    <TableRow hoverable={false}>
                      <TableHead style={{ padding: '10px 16px' }}>Date</TableHead>
                      <TableHead style={{ padding: '10px 16px', textAlign: 'right' }}>Change</TableHead>
                      <TableHead style={{ padding: '10px 16px' }}>Reason</TableHead>
                      <TableHead style={{ padding: '10px 16px', textAlign: 'right' }}>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockMovements
                      .filter((m) => m.productId === editingProduct.id)
                      .map((m) => (
                        <TableRow key={m.id} hoverable={false}>
                          <TableCell style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                            {m.createdAt}
                          </TableCell>
                          <TableCell style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: m.qtyChange >= 0 ? 'var(--tuw-text-success, #187343)' : 'var(--tuw-text-error, #C91818)' }}>
                            {m.qtyChange >= 0 ? `+${m.qtyChange}` : m.qtyChange}
                          </TableCell>
                          <TableCell style={{ padding: '10px 16px' }}>
                            <Badge variant="neutral" size="sm">{m.reason.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, color: 'var(--tuw-text-primary, #262626)' }}>
                            {m.qtyAfter}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                  No movements yet — edit stock and save to grow this ledger.
                </div>
              )}
            </DrawerCard>
          </div>
  );
}