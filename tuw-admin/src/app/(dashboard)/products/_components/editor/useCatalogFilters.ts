'use client';

import React from 'react';
import type { ProductItem } from '@/lib/admin-dto';
import {
  deriveCategoryOptions, filterProducts, paginateProducts, catalogCounts,
} from './productEditorUtils';

export type PublicationFilter = 'all' | 'published' | 'draft' | 'archived';
export type StockFilter = 'all' | 'low' | 'out';
export type CatalogView = 'grid' | 'table';

export function useCatalogFilters(products: ProductItem[], categories: string[]) {
  const categoryOptions = React.useMemo(() => deriveCategoryOptions(categories, products), [categories, products]);

  const [selectedCat, setSelectedCat] = React.useState<string>('All');
  const [publicationFilter, setPublicationFilter] = React.useState<PublicationFilter>('all');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [view, setView] = React.useState<CatalogView>('table');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(6);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam === 'draft') {
        setPublicationFilter('draft');
      } else if (statusParam === 'published') {
        setPublicationFilter('published');
      } else if (statusParam === 'scheduled') {
        setPublicationFilter('draft');
      } else if (!statusParam) {
        setPublicationFilter('all');
      }
    }
  }, []);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCat, publicationFilter, stockFilter]);

  const filteredProducts = filterProducts(products, {
    search: searchTerm,
    category: selectedCat,
    publication: publicationFilter,
    stock: stockFilter,
  });
  const { totalPages, pageProducts: paginatedProducts } = paginateProducts(filteredProducts, currentPage, pageSize);

  const pageIds = paginatedProducts.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const changeView = (v: CatalogView) => {
    setView(v);
    setSelectedIds(new Set());
  };
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageIds.every((id) => next.has(id))) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const { lowStock: lowStockCount, outOfStock: outOfStockCount, drafts: draftCount } = catalogCounts(products);
  const filtersClear = selectedCat === 'All' && publicationFilter === 'all' && stockFilter === 'all';
  const clearProductFilters = () => {
    setSelectedCat('All');
    setPublicationFilter('all');
    setStockFilter('all');
  };
  const toggleStockFilter = (v: 'low' | 'out') =>
    setStockFilter((cur) => (cur === v ? 'all' : v));
  const togglePublicationFilter = (v: PublicationFilter) =>
    setPublicationFilter((cur) => (cur === v ? 'all' : v));
  const kpiKeyDown =
    (handler: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    };

  return {
    categoryOptions, selectedCat, setSelectedCat, publicationFilter, setPublicationFilter,
    stockFilter, setStockFilter, searchTerm, setSearchTerm, view, setView,
    selectedIds, setSelectedIds, currentPage, setCurrentPage, pageSize, setPageSize,
    filteredProducts, paginatedProducts, totalPages,
    allPageSelected, somePageSelected,
    lowStockCount, outOfStockCount, draftCount, filtersClear,
    changeView, toggleId, togglePage, clearSelection,
    clearProductFilters, toggleStockFilter, togglePublicationFilter, kpiKeyDown,
  };
}
