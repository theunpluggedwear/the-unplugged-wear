'use client';

import React from 'react';
import { Plus, Library, Tag, CheckCircle2, Upload, Search, ChevronDown, LayoutGrid, List, Edit3, Download, Archive, Trash2 } from 'lucide-react';
import { PageHeader, LinkButton, Button, Input, StatCard, FilterPills, DropdownMenu, ViewToggle, ContentCard, Badge, ImageWithFallback, Checkbox, Table, TableHeader, TableRow, TableCell, TableHead, TableBody, Pagination } from '@/components/ui';
import type { ProductItem } from '@/lib/admin-dto';

const styles = new Proxy<Record<string, string>>({}, { get: (_t, p) => 'sub-' + String(p) });

type PublicationFilter = 'all' | 'published' | 'draft' | 'archived';
type StockFilter = 'all' | 'low' | 'out';
type ViewMode = 'grid' | 'table';

export interface CatalogListProps {
  can: (permission: string) => boolean;
  refused: (what: string) => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportFile: (file: File | undefined) => void;
  openCreateDrawer: () => void;
  products: ProductItem[];
  filtersClear: boolean;
  lowStockCount: number;
  draftCount: number;
  outOfStockCount: number;
  stockFilter: StockFilter;
  publicationFilter: PublicationFilter;
  setPublicationFilter: React.Dispatch<React.SetStateAction<PublicationFilter>>;
  clearProductFilters: () => void;
  kpiKeyDown: (handler: () => void) => (e: React.KeyboardEvent) => void;
  toggleStockFilter: (v: 'low' | 'out') => void;
  togglePublicationFilter: (v: PublicationFilter) => void;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  selectedCat: string;
  categoryOptions: Array<{ value: string; label: string }>;
  setSelectedCat: React.Dispatch<React.SetStateAction<string>>;
  view: ViewMode;
  changeView: (v: ViewMode) => void;
  filteredProducts: ProductItem[];
  paginatedProducts: ProductItem[];
  assetSrc: (url: string) => string;
  openingId: string | null;
  openEditDrawer: (p: ProductItem) => void;
  selectedIds: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  togglePage: () => void;
  handleExportSelected: () => void;
  handleBulkStatus: (status: 'published' | 'archived', label: string) => void;
  handleBulkDelete: () => void;
  toggleId: (id: string) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
}

export default function CatalogList(props: CatalogListProps) {
  const {
    can,
    refused,
    csvInputRef,
    handleImportFile,
    openCreateDrawer,
    products,
    filtersClear,
    lowStockCount,
    draftCount,
    outOfStockCount,
    stockFilter,
    publicationFilter,
    setPublicationFilter,
    clearProductFilters,
    kpiKeyDown,
    toggleStockFilter,
    togglePublicationFilter,
    searchTerm,
    setSearchTerm,
    selectedCat,
    categoryOptions,
    setSelectedCat,
    view,
    changeView,
    filteredProducts,
    paginatedProducts,
    assetSrc,
    openingId,
    openEditDrawer,
    selectedIds,
    allPageSelected,
    somePageSelected,
    togglePage,
    handleExportSelected,
    handleBulkStatus,
    handleBulkDelete,
    toggleId,
    currentPage,
    totalPages,
    pageSize,
    setCurrentPage,
    setPageSize,
  } = props;

  return (
    <>
      <PageHeader
        title="Product Catalog"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <LinkButton
              href="/settings/attributes"
              variant="secondary"
              size="md"
              icon={<Library size={16} />}
            >
              <span>Attribute Library</span>
            </LinkButton>
            <LinkButton href="/products/categories" variant="secondary" size="md" icon={<Tag size={16} />}>
              Categories
            </LinkButton>
            <LinkButton href="/products/reviews" variant="secondary" size="md" icon={<CheckCircle2 size={16} />}>
              Reviews
            </LinkButton>
            <Button
              variant="secondary"
              size="md"
              icon={<Upload size={16} />}
              onClick={() => {
                if (!can('product.import')) return refused('import products');
                csvInputRef.current?.click();
              }}
            >
              <span>Import Products</span>
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              aria-label="Import products CSV"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleImportFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              onClick={openCreateDrawer}
            >
              <span>Add New Product</span>
            </Button>
          </div>
        }
      />

      {}
      <div className={styles.statGrid}>
        <StatCard
          label="Total Products"
          value={String(products.length)}
          trend="In the database"
          trendType="up"
          hoverable
          role="button"
          tabIndex={0}
          aria-pressed={filtersClear}
          aria-label="Show all products"
          className={filtersClear ? 'tuw-stat-active' : ''}
          style={{ cursor: 'pointer' }}
          onClick={clearProductFilters}
          onKeyDown={kpiKeyDown(clearProductFilters)}
        />
        <StatCard
          label="Low Stock Alerts"
          value={String(lowStockCount)}
          subtitle="At or below each product's alert level"
          trendType={lowStockCount > 0 ? 'down' : 'up'}
          hoverable
          role="button"
          tabIndex={0}
          aria-pressed={stockFilter === 'low'}
          aria-label="Filter low-stock products"
          className={stockFilter === 'low' ? 'tuw-stat-active' : ''}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleStockFilter('low')}
          onKeyDown={kpiKeyDown(() => toggleStockFilter('low'))}
        />
        <StatCard
          label="Drafts in Review"
          value={String(draftCount)}
          subtitle="Unpublished items"
          trendType="neutral"
          hoverable
          role="button"
          tabIndex={0}
          aria-pressed={publicationFilter === 'draft'}
          aria-label="Filter draft products"
          className={publicationFilter === 'draft' ? 'tuw-stat-active' : ''}
          style={{ cursor: 'pointer' }}
          onClick={() => togglePublicationFilter('draft')}
          onKeyDown={kpiKeyDown(() => togglePublicationFilter('draft'))}
        />
        <StatCard
          label="Out of Stock"
          value={String(outOfStockCount)}
          subtitle={outOfStockCount > 0 ? 'Backorder only' : 'Fully stocked'}
          trendType={outOfStockCount > 0 ? 'down' : 'up'}
          hoverable
          role="button"
          tabIndex={0}
          aria-pressed={stockFilter === 'out'}
          aria-label="Filter out-of-stock products"
          className={stockFilter === 'out' ? 'tuw-stat-active' : ''}
          style={{ cursor: 'pointer' }}
          onClick={() => toggleStockFilter('out')}
          onKeyDown={kpiKeyDown(() => toggleStockFilter('out'))}
        />
      </div>

      {}
      <ContentCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tuw-text-secondary, #5D6772)', textTransform: 'uppercase' }}>
                Status:
              </span>
              <FilterPills
                variant="pills"
                ariaLabel="Publication status filter"
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={publicationFilter}
                onChange={(v) => setPublicationFilter(v as typeof publicationFilter)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, gap: 12 }}>
              <div style={{ maxWidth: 300, width: '100%' }}>
                <Input
                  placeholder="Search products by title, category, or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  prefixIcon={<Search size={16} />}
                />
              </div>
              <DropdownMenu
                ariaLabel="Product category filter"
                trigger={
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Product category, currently ${selectedCat === 'All' ? 'All Categories' : selectedCat}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      height: '44px',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: 'var(--font-main)',
                      borderRadius: 'var(--tuw-radius-control, 8px)',
                      border: '1px solid var(--tuw-border-control, #D1D5DB)',
                      backgroundColor: 'var(--tuw-bg-surface, #FFFFFF)',
                      color: 'var(--tuw-text-primary, #262626)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Tag size={14} color="var(--tuw-text-secondary, #5D6772)" />
                    {selectedCat === 'All' ? 'All Categories' : selectedCat}
                    <ChevronDown size={14} color="var(--tuw-text-secondary, #5D6772)" />
                  </span>
                }
                items={[
                  { value: 'All', label: 'All Categories' },
                  ...categoryOptions,
                ]}
                selectedValue={selectedCat}
                onSelect={(v) => setSelectedCat(v)}
              />
              <div aria-hidden="true" style={{ width: 1, height: 24, backgroundColor: 'var(--tuw-border-subtle, #E5E7EB)' }} />
              <ViewToggle
                ariaLabel="Product catalog view"
                options={[
                  { value: 'grid', label: 'Grid view', icon: <LayoutGrid size={16} /> },
                  { value: 'table', label: 'Table view', icon: <List size={16} /> },
                ]}
                value={view}
                onChange={(v) => changeView(v as typeof view)}
              />
            </div>
          </div>
        </div>

        {view === 'grid' ? (
        
        <div className={styles.cardGrid}>
          {filteredProducts.length === 0 ? (
            <div style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--tuw-text-secondary, #5D6772)', gridColumn: '1 / -1' }}>
              No products found matching the selected filters.
            </div>
          ) : (
            paginatedProducts.map((p) => (
              <div key={p.id} className={`${styles.productCatalogCard} tuw-stat-hover`}>
                <div
                  className={styles.productThumbFrame}
                  style={{
                    background: 'var(--tuw-bg-canvas, #F7F8F9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {p.images[0] ? (
                    <ImageWithFallback
                      src={assetSrc(p.images[0])}
                      alt={p.name}
                      optimized
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      fallbackTone="neutral"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                    <Badge
                      variant={
                        p.publicationStatus === 'published'
                          ? 'success'
                          : p.publicationStatus === 'draft'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {p.publicationStatus}
                    </Badge>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', display: 'block' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {p.category} · {p.partner}
                    </span>
                  </div>
                  <Badge variant={p.madeToOrder || p.stock > (p.lowStockAt ?? 10) ? 'success' : p.stock > 0 ? 'warning' : 'danger'}>
                    {p.madeToOrder ? 'Made to order' : p.stock > (p.lowStockAt ?? 10) ? `${p.stock} in stock` : p.stock > 0 ? `Low: ${p.stock}` : 'Out of stock'}
                  </Badge>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {p.sizes.map((s) => (
                    <span key={s} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--tuw-bg-canvas, #F7F8F9)', borderRadius: 4, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {s}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--tuw-border-subtle, #E2E4E6)' }}>
                  <div>
                    <span className="tuw-tabular-nums" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
                      {p.priceSpread && (
                        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tuw-text-secondary, #5D6772)', marginRight: 5 }}>From</span>
                      )}
                      ₹{p.price.toFixed(2)}
                    </span>
                    {p.compareAtPrice && p.compareAtPrice > p.price && (
                      <span className="tuw-tabular-nums" style={{ fontSize: '13px', color: 'var(--tuw-text-secondary, #5D6772)', textDecoration: 'line-through', marginLeft: 6 }}>
                        ₹{p.compareAtPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <Button variant="secondary" size="sm" icon={<Edit3 size={14} />} disabled={openingId === p.id} aria-busy={openingId === p.id} onClick={() => void openEditDrawer(p)}>
                    Manage
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        ) : (
        
        <Table style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '14.5%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <TableHeader>
            {selectedIds.size > 0 ? (
            <TableRow hoverable={false}>
              <TableCell colSpan={7} style={{ padding: '6px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Checkbox
                    bare
                    aria-label="Select all products on this page"
                    checked={allPageSelected}
                    indeterminate={!allPageSelected && somePageSelected}
                    onChange={togglePage}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
                    {selectedIds.size} selected
                  </span>
                  <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportSelected}>
                    Export selected
                  </Button>
                  <Button variant="primary" size="sm" icon={<CheckCircle2 size={14} />} onClick={() => handleBulkStatus('published', 'Published')}>
                    Publish
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Archive size={14} />} onClick={() => handleBulkStatus('archived', 'Archived')}>
                    Archive
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleBulkDelete}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ) : (
            <TableRow hoverable={false}>
              <TableHead style={{ padding: '12px 16px', width: 44 }}>
                <Checkbox
                  bare
                  aria-label="Select all products on this page"
                  checked={allPageSelected}
                  indeterminate={!allPageSelected && somePageSelected}
                  onChange={togglePage}
                />
              </TableHead>
              <TableHead style={{ padding: '12px 16px' }}>Product</TableHead>
              <TableHead style={{ padding: '12px 16px' }}>Category</TableHead>
              <TableHead style={{ padding: '12px 16px', textAlign: 'right' }}>Price</TableHead>
              <TableHead style={{ padding: '12px 16px' }}>Stock / Sold</TableHead>
              <TableHead style={{ padding: '12px 16px' }}>Status</TableHead>
              <TableHead style={{ padding: '12px 16px', textAlign: 'right' }}>Action</TableHead>
            </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow hoverable={false}>
                <TableCell colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--tuw-text-secondary, #5D6772)', fontSize: 16 }}>
                  No products found matching the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => void openEditDrawer(p)}
                  style={{ cursor: 'pointer', backgroundColor: selectedIds.has(p.id) ? 'var(--tuw-bg-canvas, #F7F8F9)' : 'transparent' }}
                >
                  <TableCell style={{ padding: '14px 16px' }}>
                    <Checkbox
                      bare
                      aria-label={`Select product ${p.name}`}
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleId(p.id)}
                    />
                  </TableCell>
                  <TableCell style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', position: 'relative', flexShrink: 0, background: 'var(--tuw-bg-canvas, #F7F8F9)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--tuw-border-subtle, #E5E7EB)' }}>
                        {p.images[0] ? (
                          <ImageWithFallback src={assetSrc(p.images[0])} alt={p.name} optimized fill sizes="80px" fallbackTone="neutral" style={{ objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tuw-text-primary, #262626)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                          {p.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: '14px 16px', fontSize: 14, color: 'var(--tuw-text-primary, #262626)' }}>
                    {p.category}
                  </TableCell>
                  <TableCell className="tuw-tabular-nums" style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', textAlign: 'right' }}>
                    {
}
                    {p.priceSpread && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--tuw-text-secondary, #5D6772)', marginRight: 4 }}>From</span>
                    )}
                    ₹{p.price.toFixed(2)}
                    {p.compareAtPrice && p.compareAtPrice > p.price && (
                      <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', textDecoration: 'line-through', marginLeft: 6, fontWeight: 400 }}>
                        ₹{p.compareAtPrice.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: p.madeToOrder ? 'var(--tuw-text-primary, #262626)' : p.stock === 0 ? 'var(--tuw-text-error, #C91818)' : p.stock <= 10 ? 'var(--tuw-text-warning, #856300)' : 'var(--tuw-text-primary, #262626)' }}>
                      {p.madeToOrder ? 'Made to order' : `${p.stock} in stock`}
                    </div>
                    <div className="tuw-tabular-nums" style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
                      {p.soldCount} sold
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: '14px 16px' }}>
                    <Badge
                      variant={
                        p.publicationStatus === 'published'
                          ? 'success'
                          : p.publicationStatus === 'draft'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {p.publicationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <Button variant="secondary" size="sm" icon={<Edit3 size={14} />} disabled={openingId === p.id} aria-busy={openingId === p.id} onClick={(e) => { e.stopPropagation(); void openEditDrawer(p); }}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}

        {filteredProducts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            pageSizeOptions={[6, 12, 24]}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        )}
      </ContentCard>
    </>
  );
}