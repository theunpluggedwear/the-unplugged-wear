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
import { PersonalizationDisplayOption, PersonalizationMonogramCard } from '@/plugins/personalization';
import { GENDER_OPTIONS, PUBLICATION_OPTIONS, DISCOUNT_TYPE_OPTIONS, PARTNER_OPTIONS, pairedFieldGrid, flatGroupStyle, attributeChipStyle, attributeMetaStyle, attributeGroupLabelStyle } from './constants';
import type { SectionProps } from './types';

export default function SpecsTab(props: SectionProps) {
  const {
    addSizeChartColumn,
    addSizeChartRow,
    chartColDrafts,
    chartColumns,
    chartRowDrafts,
    createSizeChart,
    deleteSizeChart,
    drawerView,
    formCare,
    formCut,
    formFabricGsm,
    formModelDims,
    formMonogramChars,
    formMonogramEnabled,
    formMonogramUpcharge,
    formSizeChartId,
    newChartName,
    patchSizeChartCell,
    products,
    removeSizeChartRow,
    setChartColDrafts,
    setChartRowDrafts,
    setFormCare,
    setFormCut,
    setFormFabricGsm,
    setFormModelDims,
    setFormMonogramChars,
    setFormMonogramEnabled,
    setFormMonogramUpcharge,
    setFormSizeChartId,
    setNewChartName,
    setSpecsClothingCardOpen,
    setSpecsDisplayCardOpen,
    setSpecsMonogramCardOpen,
    setSpecsSizeChartCardOpen,
    setVisibleSections,
    showToast,
    sizeCharts,
    specsClothingCardOpen,
    specsDisplayCardOpen,
    specsMonogramCardOpen,
    specsSizeChartCardOpen,
    visibleSections,
  } = props.vm;
  return (
          <div
            className={`tuw-pedit-specs-grid${drawerView !== 'compact' ? ' is-expanded' : ''}`}
          >
            <DrawerCard
              title="1. Display options"
              description="Choose which specification blocks appear in this editor"
              collapsible
              isOpen={specsDisplayCardOpen}
              onToggle={setSpecsDisplayCardOpen}
              bodyGap={12}
            >
              <PersonalizationDisplayOption
                visible={visibleSections.monogram}
                onChange={(v) => setVisibleSections((s) => ({ ...s, monogram: v }))}
              />
            </DrawerCard>
            <DrawerCard
              title="2. Clothing specifications"
              description="Fabric, cut, fit, and care copy shown on the product page"
              collapsible
              isOpen={specsClothingCardOpen}
              onToggle={setSpecsClothingCardOpen}
              bodyGap={16}
            >
                <Input
                  data-field="fabricGsm"
                  label="Fabric Composition & GSM"
                  placeholder="460 GSM Heavyweight French Terry Cotton"
                  value={formFabricGsm}
                  onChange={(e) => setFormFabricGsm(e.target.value)}
                />
                <Input
                  data-field="cut"
                  label="Cut & Silhouette"
                  placeholder="Boxy Drop-Shoulder"
                  value={formCut}
                  onChange={(e) => setFormCut(e.target.value)}
                />
                <Input
                  data-field="modelDims"
                  label="Model Dimensions"
                  placeholder="Model is 6'1&quot; wearing Size L"
                  value={formModelDims}
                  onChange={(e) => setFormModelDims(e.target.value)}
                />
                <FormTextarea
                  data-field="care"
                  label="Care & Wash Instructions"
                  rows={3}
                  placeholder="Cold wash inside out, lay flat to dry"
                  value={formCare}
                  onChange={(e) => setFormCare(e.target.value)}
                />
            </DrawerCard>
            <DrawerCard
              title="3. Size chart"
              description="Reusable measuring set and the linked fit guide"
              collapsible
              isOpen={specsSizeChartCardOpen}
              onToggle={setSpecsSizeChartCardOpen}
              bodyGap={16}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                    Associated Size Chart Template
                  </span>
                  <Link href="/content/pages" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-action-primary, #7539FF)', textDecoration: 'none' }}>
                    Open Fit Guide
                  </Link>
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tuw-text-primary, #262626)', display: 'block', marginBottom: 6 }}>
                    Size Chart
                  </span>
                  <DropdownMenu
                    ariaLabel="Product size chart"
                    fullWidth
                    trigger={
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Size chart, currently ${sizeCharts.find((c) => c.id === formSizeChartId)?.name ?? 'None'}`}
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
                          border: '1px solid var(--tuw-border-control, #D1D5DB)',
                          backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
                          color: 'var(--tuw-text-primary, #262626)',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sizeCharts.find((c) => c.id === formSizeChartId)?.name ?? 'No chart — legacy guide applies'}
                        </span>
                        <ChevronDown size={14} color="var(--tuw-text-secondary, #5D6772)" />
                      </span>
                    }
                    items={[
                      { value: '', label: 'No chart — legacy guide applies' },
                      ...sizeCharts.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    selectedValue={formSizeChartId}
                    onSelect={(v) => setFormSizeChartId(v)}
                  />
                </div>
                <Disclosure
                  title={`Size charts (${sizeCharts.length})`}
                  subtitle="Measuring sets by garment. Columns vary — hoodies track sleeve, pants track waist."
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sizeCharts.map((chart) => {
                      const cols = chartColumns(chart);
                      return (
                        <div key={chart.id} style={flatGroupStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
                              {chart.name}
                            </span>
                            <UpliftSurface active width={28} height={28} className="tuw-danger-hover" style={{ flexShrink: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                              <button
                                type="button"
                                aria-label={`Remove chart ${chart.name}`}
                                onClick={() => {
                                  const usedBy = products.find((p) => p.sizeChartId === chart.id);
                                  if (usedBy) {
                                    showToast({ type: 'warning', title: 'Chart In Use', description: `"${chart.name}" is assigned to ${usedBy.name} — reassign first.` });
                                    return;
                                  }
                                  deleteSizeChart(chart.id);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </UpliftSurface>
                          </div>
                          {chart.rows.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow hoverable={false}>
                                  <TableHead style={{ padding: '10px 16px' }}>Size</TableHead>
                                  {cols.map((col) => (
                                    <TableHead key={col} style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{col} (cm)</TableHead>
                                  ))}
                                  <TableHead style={{ padding: '10px 16px', width: 48 }}><span className="sr-only">Remove</span></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {chart.rows.map((row) => (
                                  <TableRow key={row.size} hoverable={false}>
                                    <TableCell style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
                                      {row.size}
                                    </TableCell>
                                    {cols.map((col) => (
                                      <TableCell key={col} style={{ padding: '10px 16px' }}>
                                        <Input
                                          aria-label={`${row.size} ${col} in cm`}
                                          type="text"
                                          inputMode="decimal"
                                          value={row.measures[col] ?? ''}
                                          onChange={(e) => patchSizeChartCell(chart.id, row.size, col, e.target.value)}
                                          style={{ height: 36 }}
                                        />
                                      </TableCell>
                                    ))}
                                    <TableCell style={{ padding: '10px 16px', width: 48 }}>
                                      <UpliftSurface active width={28} height={28} className="tuw-danger-hover" style={{ flexShrink: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                                        <button
                                          type="button"
                                          aria-label={`Remove size ${row.size} from ${chart.name}`}
                                          onClick={() => removeSizeChartRow(chart.id, row.size)}
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
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                              No sizes yet — add the first one below.
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <Input
                                aria-label={`Add size to ${chart.name}`}
                                placeholder="Size, e.g. XXS"
                                value={chartRowDrafts[chart.id] ?? ''}
                                onChange={(e) => setChartRowDrafts((prev) => ({ ...prev, [chart.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (addSizeChartRow(chart.id, chartRowDrafts[chart.id] ?? '')) {
                                      setChartRowDrafts((prev) => ({ ...prev, [chart.id]: '' }));
                                    }
                                  }
                                }}
                              />
                            </div>
                            <Button
                              variant="secondary"
                              size="md"
                              type="button"
                              onClick={() => {
                                if (addSizeChartRow(chart.id, chartRowDrafts[chart.id] ?? '')) {
                                  setChartRowDrafts((prev) => ({ ...prev, [chart.id]: '' }));
                                }
                              }}
                              disabled={(chartRowDrafts[chart.id] ?? '').trim() === ''}
                            >
                              Add
                            </Button>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <Input
                                aria-label={`Add measurement column to ${chart.name}`}
                                placeholder="Measurement, e.g. Chest"
                                value={chartColDrafts[chart.id] ?? ''}
                                onChange={(e) => setChartColDrafts((prev) => ({ ...prev, [chart.id]: e.target.value }))}
                              />
                            </div>
                            <Button
                              variant="secondary"
                              size="md"
                              type="button"
                              onClick={() => {
                                if (addSizeChartColumn(chart.id, chartColDrafts[chart.id] ?? '')) {
                                  setChartColDrafts((prev) => ({ ...prev, [chart.id]: '' }));
                                }
                              }}
                              disabled={(chartColDrafts[chart.id] ?? '').trim() === ''}
                            >
                              Add column
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Input
                          aria-label="New chart name"
                          placeholder="New chart, e.g. Kids Tops"
                          value={newChartName}
                          onChange={(e) => setNewChartName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (createSizeChart(newChartName)) setNewChartName('');
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Plus size={14} />}
                        type="button"
                        onClick={() => {
                          if (createSizeChart(newChartName)) setNewChartName('');
                        }}
                        disabled={newChartName.trim() === ''}
                      >
                        Add Chart
                      </Button>
                    </div>
                  </div>
                </Disclosure>
            </DrawerCard>
            <PersonalizationMonogramCard
              visible={visibleSections.monogram}
              cardOpen={specsMonogramCardOpen}
              onCardToggle={setSpecsMonogramCardOpen}
              enabled={formMonogramEnabled}
              onEnabledChange={setFormMonogramEnabled}
              maxChars={formMonogramChars}
              onMaxCharsChange={setFormMonogramChars}
              upcharge={formMonogramUpcharge}
              onUpchargeChange={setFormMonogramUpcharge}
            />
          </div>
  );
}