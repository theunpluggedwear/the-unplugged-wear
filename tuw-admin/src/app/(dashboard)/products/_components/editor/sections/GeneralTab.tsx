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

export default function GeneralTab(props: SectionProps) {
  const {
    addAttribute,
    addDiscount,
    addDiscountRef,
    attributesCardOpen,
    basicCardOpen,
    categoryOptions,
    discountsCardOpen,
    drawerView,
    formAttributes,
    formCategory,
    formCompareError,
    formComparePrice,
    formDescription,
    formDims,
    formDiscounts,
    formExchangePolicy,
    formGender,
    formHsn,
    formLowStock,
    formName,
    formPartner,
    formPrice,
    formProductKind,
    formSerialNo,
    formShipWeight,
    formSlug,
    formStatus,
    formStock,
    formStyleCode,
    formTax,
    formWeight,
    fulfillmentCardOpen,
    handleEditSubmit,
    internalAttributes,
    libraryAttributes,
    linkFromLibrary,
    newAttrName,
    patchDiscount,
    pricingCardOpen,
    removeDiscount,
    renderAttributeRow,
    setAttributesCardOpen,
    setBasicCardOpen,
    setDiscountsCardOpen,
    setFormCategory,
    setFormCompareError,
    setFormComparePrice,
    setFormDescription,
    setFormDims,
    setFormExchangePolicy,
    setFormGender,
    setFormHsn,
    setFormLowStock,
    setFormName,
    setFormPartner,
    setFormProductKind,
    setFormShipWeight,
    setFormSlug,
    setFormStatus,
    setFormStyleCode,
    setFormTax,
    setFormWeight,
    setFulfillmentCardOpen,
    setNewAttrName,
    setPricingCardOpen,
    storefrontAttributes,
    writeBasePrice,
    writeStockTotal,
  } = props.vm;
  return (
          <form
            onSubmit={handleEditSubmit}
            className={`tuw-pedit-general-grid${drawerView !== 'compact' ? ' is-expanded' : ''}`}
          >
            <DrawerCard
              title="1. Basic Information"
              description="Core identity, storefront copy, and catalog classification"
              collapsible
              isOpen={basicCardOpen}
              onToggle={setBasicCardOpen}
            >
              <Input
                data-field="name"
                label="Product Title"
                placeholder="e.g. Urbanist Heavyweight Tee"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={255}
                required
              />
              <Input
                data-field="slug"
                label="URL Slug"
                placeholder="e.g. urbanist-heavyweight-tee"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                maxLength={280}
                required
              />
              <FormTextarea
                data-field="description"
                label="Description"
                rows={4}
                fontSize={14}
                pad="10px 12px"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
              <div style={pairedFieldGrid}>
                <Input
                  data-field="styleCode"
                  label="Style Code"
                  placeholder="e.g. FC34"
                  value={formStyleCode}
                  onChange={(e) => setFormStyleCode(e.target.value)}
                  maxLength={50}
                  labelTooltip="Internal production reference — not shown to customers."
                />
                <div data-field="category">
                  <SearchableSelect
                    label="Category"
                    options={categoryOptions}
                    value={formCategory}
                    onChange={(value) => setFormCategory(value)}
                    required
                  />
                </div>
              </div>
              {formSerialNo ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: '18px',
                    color: 'var(--tuw-text-secondary)',
                  }}
                >
                  Internal S.No <strong style={{ color: 'var(--tuw-text-primary)' }}>{formSerialNo}</strong>{' '}
                  — workbook reference only, never shown to customers.
                </p>
              ) : null}
              <div style={pairedFieldGrid}>
                <SearchableSelect
                  label="Gender"
                  options={GENDER_OPTIONS}
                  value={formGender || 'unspecified'}
                  onChange={(value) =>
                    setFormGender(
                      value === 'unspecified' ? '' : (value as ProductGender)
                    )
                  }
                />
                <SearchableSelect
                  label="Publication status"
                  options={PUBLICATION_OPTIONS}
                  value={formStatus}
                  onChange={(value) =>
                    setFormStatus(value as ProductItem['publicationStatus'])
                  }
                />
              </div>
            </DrawerCard>
            <DrawerCard
              title="2. Pricing & stock"
              description="Selling price, compare-at reference, stock, and checkout tax"
              collapsible
              isOpen={pricingCardOpen}
              onToggle={setPricingCardOpen}
            >
              <div style={pairedFieldGrid}>
                <Input
                  data-field="price"
                  label="Base price (₹)"
                  type="text"
                  inputMode="decimal"
                  value={formPrice}
                  onChange={(e) => writeBasePrice(e.target.value)}
                  required
                />
                <Input
                  data-field="compareAtPrice"
                  label="Compare-at price (₹)"
                  type="text"
                  inputMode="decimal"
                  placeholder="Optional"
                  value={formComparePrice}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^\d*\.?\d*$/.test(raw)) return;
                    setFormComparePrice(raw);
                    if (formCompareError) setFormCompareError(null);
                  }}
                  error={formCompareError ?? undefined}
                  labelTooltip="Optional catalog reference. Shown struck through only when it is higher than the current selling price; it does not affect the price charged."
                />
              </div>
              <div style={pairedFieldGrid}>
                <Input
                  data-field="stock"
                  label="Stock Quantity"
                  type="number"
                  min={0}
                  value={formStock}
                  onChange={(e) => writeStockTotal(e.target.value)}
                  required
                />
                <Input
                  data-field="taxRate"
                  label="Tax Rate (%)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 18"
                  value={formTax}
                  onChange={(e) => setFormTax(e.target.value)}
                />
              </div>
              <Input
                data-field="hsnCode"
                label="HSN code"
                inputMode="numeric"
                placeholder="e.g. 61091000"
                value={formHsn}
                onChange={(e) => setFormHsn(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={8}
                labelTooltip="HSN/SAC classification for checkout and tax reports. 4–8 digits; never shown on the storefront."
              />
            </DrawerCard>
            <DrawerCard
              title="3. Scheduled discounts"
              description="Time-boxed price cuts with a start, end, and active switch"
              collapsible
              isOpen={discountsCardOpen}
              onToggle={setDiscountsCardOpen}
              badge={
                formDiscounts.length > 0 ? (
                  <Badge variant="neutral" size="sm">
                    {formDiscounts.length} {formDiscounts.length === 1 ? 'discount' : 'discounts'}
                  </Badge>
                ) : undefined
              }
            >
              {formDiscounts.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--tuw-text-secondary)' }}>
                  No scheduled discounts. The product uses its normal selling price.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {formDiscounts.map((d, index) => {
                    const rowTitleId = `discount-${d.id}-title`;
                    return (
                      <div
                        key={d.id}
                        role="group"
                        aria-labelledby={rowTitleId}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          padding: 12,
                          border: '1px solid var(--tuw-border-subtle)',
                          borderRadius: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <h5
                            id={rowTitleId}
                            style={{
                              margin: 0,
                              fontSize: 14,
                              lineHeight: '22px',
                              fontWeight: 600,
                              color: 'var(--tuw-text-primary)',
                            }}
                          >
                            Discount {index + 1}
                          </h5>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Switch
                              label="Active"
                              ariaLabel={`Discount ${index + 1} active`}
                              checked={d.isActive}
                              onChange={(v) => patchDiscount(d.id, { isActive: v })}
                            />
                            <UpliftSurface
                              active
                              width={32}
                              height={32}
                              className="tuw-danger-hover"
                              style={{ flexShrink: 0, color: 'var(--tuw-text-secondary)' }}
                            >
                              <button
                                type="button"
                                aria-label={`Remove discount ${index + 1}`}
                                onClick={() => removeDiscount(d.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                  height: '100%',
                                  padding: 0,
                                  border: 'none',
                                  borderRadius: 'inherit',
                                  background: 'transparent',
                                  color: 'inherit',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </UpliftSurface>
                          </div>
                        </div>
                        <div style={pairedFieldGrid}>
                          <SearchableSelect
                            label="Type"
                            ariaLabel={`Discount ${index + 1} type`}
                            options={DISCOUNT_TYPE_OPTIONS}
                            value={d.discountType}
                            onChange={(value) => {
                              const discountType = value as ProductDiscount['discountType'];
                              patchDiscount(d.id, {
                                discountType,
                                value:
                                  discountType === 'percent'
                                    ? Math.min(100, Math.max(0, d.value))
                                    : Math.max(0, d.value),
                              });
                            }}
                            searchable={false}
                          />
                          <Input
                            id={`discount-${d.id}-value`}
                            label={d.discountType === 'percent' ? 'Value (%)' : 'Value (₹)'}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            max={d.discountType === 'percent' ? 100 : undefined}
                            value={String(d.value)}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value);
                              if (Number.isNaN(n)) return;
                              patchDiscount(d.id, {
                                value:
                                  d.discountType === 'percent'
                                    ? Math.min(100, Math.max(0, n))
                                    : Math.max(0, n),
                              });
                            }}
                          />
                        </div>
                        <div style={pairedFieldGrid}>
                          <Input
                            id={`discount-${d.id}-starts`}
                            label="Starts"
                            type="date"
                            value={d.startsAt}
                            onChange={(e) => patchDiscount(d.id, { startsAt: e.target.value })}
                          />
                          <Input
                            id={`discount-${d.id}-ends`}
                            label="Ends"
                            type="date"
                            value={d.endsAt}
                            onChange={(e) => patchDiscount(d.id, { endsAt: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={addDiscountRef} data-field="discounts" style={{ display: 'flex' }}>
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} type="button" onClick={addDiscount}>
                  Add Discount
                </Button>
              </div>
            </DrawerCard>
            <DrawerCard
              title="4. Fulfillment & shipping"
              description="Production partner and parcel measurements; print locations live under Attributes & values"
              collapsible
              isOpen={fulfillmentCardOpen}
              onToggle={setFulfillmentCardOpen}
            >
              <div style={pairedFieldGrid}>
                <div data-field="partner">
                <SearchableSelect
                  label="Print partner"
                  options={PARTNER_OPTIONS}
                  value={formPartner}
                  onChange={(value) => setFormPartner(value as ProductItem['partner'])}
                  required
                />
                </div>
                <SearchableSelect
                  label="Exchange policy"
                  options={[
                    { value: 'defects_only', label: 'Defects only', description: 'Replaced if damaged, misprinted or wrong' },
                    { value: 'exchangeable', label: 'Exchangeable', description: 'Another variant within the exchange window' },
                    { value: 'none', label: 'No exchanges', description: 'Final sale' },
                  ]}
                  value={formExchangePolicy}
                  onChange={(value) => setFormExchangePolicy(value as typeof formExchangePolicy)}
                />
              </div>
              <div style={pairedFieldGrid}>
                <SearchableSelect
                  label="Product kind"
                  options={[
                    { value: 'physical', label: 'Physical product', description: 'Printed and shipped' },
                    { value: 'gift_card', label: 'Gift card', description: 'Hidden from the catalog; sold through gift cards' },
                  ]}
                  value={formProductKind}
                  onChange={(value) => setFormProductKind(value as typeof formProductKind)}
                />
                <Input
                  data-field="lowStockThreshold"
                  label="Low stock alert at"
                  placeholder="Store default"
                  inputMode="numeric"
                  value={formLowStock}
                  onChange={(e) => setFormLowStock(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div style={pairedFieldGrid}>
                <Input
                  data-field="weight"
                  label="Weight (g)"
                  placeholder="e.g. 180"
                  inputMode="numeric"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                />
                <Input
                  data-field="shippingWeight"
                  label="Shipping weight (g)"
                  placeholder="e.g. 250"
                  inputMode="numeric"
                  value={formShipWeight}
                  onChange={(e) => setFormShipWeight(e.target.value)}
                />
              </div>
              <Input
                data-field="dimensions"
                label="Package dimensions (cm)"
                placeholder="e.g. 18 × 20 × 2.3"
                value={formDims}
                onChange={(e) => setFormDims(e.target.value)}
              />
            </DrawerCard>
            <DrawerCard
              title="5. Attributes & values"
              description="Storefront choices and internal production values"
              collapsible
              isOpen={attributesCardOpen}
              onToggle={setAttributesCardOpen}
              className="tuw-pedit-general-wide"
            >
              <div data-field="attributes" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {libraryAttributes.filter((a) => a.enabled).length > 0 ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <DropdownMenu
                        ariaLabel="Link attribute from library"
                        fullWidth
                        trigger={
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Link an attribute from the library"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              width: '100%',
                              height: 40,
                              padding: '0 12px',
                              fontSize: 13,
                              fontWeight: 500,
                              fontFamily: 'var(--font-main)',
                              borderRadius: 8,
                              border: '1px dashed var(--tuw-border-control, #D1D5DB)',
                              backgroundColor: 'transparent',
                              color: 'var(--tuw-text-secondary, #5D6772)',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Link attribute from library…
                            </span>
                            <ChevronDown size={14} color="var(--tuw-text-secondary, #5D6772)" />
                          </span>
                        }
                        items={libraryAttributes
                          .filter((a) => a.enabled)
                          .map((a) => ({ value: a.id, label: `${a.name} (${a.values.length})` }))}
                        onSelect={(v) => linkFromLibrary(v)}
                      />
                    </div>
                  ) : null}
                  <LinkButton
                    href="/settings/attributes"
                    variant="outline"
                    size="md"
                    style={{ flexShrink: 0, color: 'var(--tuw-action-primary)', whiteSpace: 'nowrap' }}
                  >
                    Manage library
                  </LinkButton>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Input
                      aria-label="New attribute name"
                      placeholder="New attribute name, e.g. Fabric"
                      value={newAttrName}
                      onChange={(e) => setNewAttrName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAttribute();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="md"
                    icon={<Plus size={14} />}
                    type="button"
                    aria-label="Add attribute"
                    onClick={addAttribute}
                    disabled={newAttrName.trim() === ''}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {storefrontAttributes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h5 style={attributeGroupLabelStyle}>Storefront</h5>
                  <div className="tuw-pedit-attribute-grid">
                    {storefrontAttributes.map((attr) => renderAttributeRow(attr))}
                  </div>
                </div>
              ) : null}

              {internalAttributes.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingTop: storefrontAttributes.length > 0 ? 12 : 0,
                    borderTop: storefrontAttributes.length > 0 ? '1px solid var(--tuw-border-subtle)' : 'none',
                  }}
                >
                  <h5 style={attributeGroupLabelStyle}>
                    Internal only <span style={{ fontWeight: 500 }}>({internalAttributes.length})</span>
                  </h5>
                  {internalAttributes.map((attr) => renderAttributeRow(attr, true))}
                </div>
              ) : null}

              {formAttributes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--tuw-text-secondary)' }}>
                  No attributes yet. Link one from the library or add one above.
                </p>
              ) : null}
            </DrawerCard>
          </form>
  );
}