'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Filter, Search, Edit3, Trash2, CheckCircle2, Eye, AlertTriangle, LayoutGrid, List, Tag, ChevronDown, Download, Archive, GripVertical, Upload, Images, Focus, Library, RotateCcw, X } from 'lucide-react';
import { StatCard, ContentCard, SurfaceCard, UpliftSurface, Button, Badge, IconButton, Input, Drawer, Modal, Pagination, FilterPills, PageHeader, ViewToggle, DropdownMenu, Checkbox, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, MediaFrame, FormTextarea, Tabs, Stepper, Switch, DrawerSection, DrawerCard, SearchableSelect, Disclosure, Carousel, LinkButton, ImageWithFallback } from '@/components/ui';
import { useToast } from '@/components/providers/ToastProvider';
import { resolveVariants, variantStockTotal, buildVariantSku, deriveVariantPrice, recomputeVariants, minFromPrice, pruneAdjustments, roundPrice, hasPriceSpread, adjustmentKey } from '@tuw/heart/modules/catalog/variants';
import type { LibraryAttribute, SizeChart } from '@tuw/heart/modules/catalog';
import type { ProductItem, ProductVariant, ProductAttribute, PhotoSettings, ProductDiscount, ProductGender, StockMovement } from '@/lib/admin-dto';
import PartnerSkuPanel from './PartnerSkuPanel';
import { saveSizeChartAction, deleteSizeChartAction, createProductAction, deleteProductsAction, getProductAction, importListingAction, setProductsStatusAction, updateProductAction } from '@/server/catalog-actions';
import { attributeDisplayLabel, normalizeAttributeDisplayType, parseCompareAtPrice, slugify, UNCATEGORIZED_CATEGORY } from '@tuw/heart/modules/catalog/rules';
import { groupImportRows, isValidHsnCode, parseQikinkListing } from '@tuw/heart/modules/catalog/planner';
import type { ImportProductGroup } from '@tuw/heart/modules/catalog/planner';
import {
  parseChartCell, baseName, colorsSizesOf, variantDraftError,
  cellAdjustment, cellPriceBreakdown, storefrontNote,
} from './editor/productEditorUtils';
import { useProductEditorDraft } from './editor/useProductEditorDraft';
import CatalogList from './editor/CatalogList';
import { useCatalogFilters } from './editor/useCatalogFilters';
import type { EditorVm } from './editor/sections/types';
import GeneralTab from './editor/sections/GeneralTab';
import MediaTab from './editor/sections/MediaTab';
import VariantsTab from './editor/sections/VariantsTab';
import SpecsTab from './editor/sections/SpecsTab';
import ImportPreviewModal from './editor/sections/ImportPreviewModal';
import { GENDER_OPTIONS, PUBLICATION_OPTIONS, DISCOUNT_TYPE_OPTIONS, PARTNER_OPTIONS, pairedFieldGrid, flatGroupStyle, attributeChipStyle, attributeMetaStyle, attributeGroupLabelStyle } from './editor/sections/constants';
import {
  editorReducer, initialEditorState, isEditorOpen, editorProduct, editorIsCreating, editorOpeningId,
} from './editor/editorMachine';
import { asyncReducer, initialAsyncState, isAsyncBusy } from './editor/asyncMachine';
import type { SaveAction } from './editor/asyncMachine';






export default function ProductsView({ initialProducts, categories, perms, storefrontOrigin, initialLibrary, initialSizeCharts, openId }: { initialProducts: ProductItem[]; categories: string[]; perms: string[]; storefrontOrigin: string; initialLibrary: LibraryAttribute[]; initialSizeCharts: SizeChart[]; openId?: string }) {
  
  const assetSrc = (url: string) => (url.startsWith('/') ? `${storefrontOrigin}${url}` : url);
  
  const { showToast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  useEffect(() => setProducts(initialProducts), [initialProducts]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [asyncState, dispatchAsync] = React.useReducer(asyncReducer, initialAsyncState);
  const saving = isAsyncBusy(asyncState);
  const [editorState, dispatchEditor] = React.useReducer(editorReducer, initialEditorState);
  const editingProduct = editorProduct(editorState);
  const isCreating = editorIsCreating(editorState);
  const openingId = editorOpeningId(editorState);

  
  
  const [libraryAttributes, setLibraryAttributes] = useState<LibraryAttribute[]>(initialLibrary);
  const createLibraryAttribute = (name: string): string => {
    const id = `new:${name}`;
    setLibraryAttributes((list) => [...list, { id, name, slug: '', values: [], swatchHex: {}, displayType: 'pill', enabled: true, showOnPdp: true, showOnCheckout: false, showOnAdmin: true, productCount: 0, core: false }]);
    return id;
  };
  const addLibraryValue = (id: string, value: string) =>
    setLibraryAttributes((list) => list.map((a) => (a.id === id ? { ...a, values: [...a.values, value] } : a)));

  
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>(initialSizeCharts);
  
  
  const chartTimers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => void }>());
  
  const cellValue = parseChartCell;
  const persistChart = (chart: SizeChart, delay = 0) => {
    const pending = chartTimers.current.get(chart.id);
    if (pending) clearTimeout(pending.timer);
    const commit = () => {
      chartTimers.current.delete(chart.id);
      
      if (chart.rows.some((r) => Object.values(r.measures).some((v) => cellValue(v) === null))) return;
      const rows = chart.rows.map((r) => ({ ...r, measures: Object.fromEntries(Object.entries(r.measures).map(([k, v]) => [k, cellValue(v)!])) }));
      void saveSizeChartAction({ id: chart.id, name: chart.name, columns: chart.columns, rows }).then((r) => {
        if (!r.ok) showToast({ type: 'warning', title: 'Size Chart Not Saved', description: r.error.message });
      });
    };
    chartTimers.current.set(chart.id, { timer: setTimeout(commit, delay), commit });
  };
  
  useEffect(() => () => {
    chartTimers.current.forEach(({ timer }) => clearTimeout(timer));
    chartTimers.current.clear();
  }, []);
  
  const flushChartTimers = () => {
    chartTimers.current.forEach(({ timer, commit }) => {
      clearTimeout(timer);
      commit();
    });
    chartTimers.current.clear();
  };
  const updateChart = (chartId: string, change: (c: SizeChart) => SizeChart, delay = 0) => {
    const chart = sizeCharts.find((c) => c.id === chartId);
    if (!chart) return false;
    const next = change(chart);
    setSizeCharts((list) => list.map((c) => (c.id === chartId ? next : c)));
    persistChart(next, delay);
    return true;
  };
  const createSizeChart = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (sizeCharts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast({ type: 'warning', title: 'Duplicate Chart', description: `"${trimmed}" already exists.` });
      return false;
    }
    void saveSizeChartAction({ name: trimmed, columns: [], rows: [] }).then((r) => {
      if (r.ok) setSizeCharts(r.data);
      else showToast({ type: 'warning', title: 'Size Chart Not Saved', description: r.error.message });
    });
    return true;
  };
  const deleteSizeChart = (id: string) => {
    void deleteSizeChartAction({ id }).then((r) => {
      if (r.ok) setSizeCharts(r.data);
      else showToast({ type: 'warning', title: 'Not Deleted', description: r.error.message });
    });
  };
  const addSizeChartRow = (chartId: string, size: string) => {
    const trimmed = size.trim();
    const chart = sizeCharts.find((c) => c.id === chartId);
    if (!trimmed || !chart) return false;
    if (chart.rows.some((r) => r.size.toLowerCase() === trimmed.toLowerCase())) {
      showToast({ type: 'warning', title: 'Duplicate Size', description: `"${trimmed}" is already in ${chart.name}.` });
      return false;
    }
    
    const blank = Object.fromEntries(chart.columns.map((k) => [k, 0]));
    return updateChart(chartId, (c) => ({ ...c, rows: [...c.rows, { size: trimmed, measures: blank }] }));
  };
  const removeSizeChartRow = (chartId: string, size: string) => updateChart(chartId, (c) => ({ ...c, rows: c.rows.filter((r) => r.size !== size) }));
  const addSizeChartColumn = (chartId: string, column: string) => {
    const name = column.trim();
    const chart = sizeCharts.find((c) => c.id === chartId);
    if (!name || !chart) return false;
    if (chart.columns.some((c) => c.toLowerCase() === name.toLowerCase())) {
      showToast({ type: 'warning', title: 'Duplicate Column', description: `"${name}" is already in ${chart.name}.` });
      return false;
    }
    return updateChart(chartId, (c) => ({ ...c, columns: [...c.columns, name], rows: c.rows.map((r) => ({ ...r, measures: { ...r.measures, [name]: 0 } })) }));
  };
  const patchSizeChartCell = (chartId: string, size: string, key: string, raw: string) => {
    return updateChart(chartId, (c) => ({ ...c, rows: c.rows.map((r) => (r.size === size ? { ...r, measures: { ...r.measures, [key]: raw } } : r)) }), 700);
  };
  const [chartColDrafts, setChartColDrafts] = useState<Record<string, string>>({});
  const can = (permission: string) => perms.includes(permission);
  const libId = (name: string) => initialLibrary.find((l) => l.name.toLowerCase() === name.toLowerCase())?.id;
  const refused = (what: string) => showToast({ type: 'warning', title: 'Action Restricted', description: `You do not have permission to ${what}.` });
  
  
  const catalogVm = useCatalogFilters(products, categories);
  const {
    categoryOptions, selectedCat, setSelectedCat, publicationFilter, setPublicationFilter,
    stockFilter, setStockFilter, searchTerm, setSearchTerm, view,
    selectedIds, currentPage, setCurrentPage, pageSize, setPageSize,
    filteredProducts, paginatedProducts, totalPages, allPageSelected, somePageSelected,
    lowStockCount, outOfStockCount, draftCount, filtersClear,
    changeView, toggleId, togglePage, clearSelection,
    clearProductFilters, toggleStockFilter, togglePublicationFilter, kpiKeyDown,
  } = catalogVm;

  
  const draftVm = useProductEditorDraft(categories[0] ?? UNCATEGORIZED_CATEGORY);
  const {
    formName, setFormName, formSlug, setFormSlug, formCategory, setFormCategory,
    formPrice, setFormPrice, formComparePrice, setFormComparePrice,
    formCompareError, setFormCompareError, formStock, setFormStock,
    formStyleCode, setFormStyleCode, formSerialNo, setFormSerialNo,
    formWeight, setFormWeight, formShipWeight, setFormShipWeight, formDims, setFormDims,
    formGender, setFormGender, formTax, setFormTax, formHsn, setFormHsn,
    formDiscounts, setFormDiscounts, formAttributes, setFormAttributes,
    attrDrafts, setAttrDrafts, newAttrName, setNewAttrName,
    chartRowDrafts, setChartRowDrafts, newChartName, setNewChartName,
    formSizeChartId, setFormSizeChartId, formPartner, setFormPartner,
    formExchangePolicy, setFormExchangePolicy, formProductKind, setFormProductKind,
    formLowStock, setFormLowStock, formStatus, setFormStatus, formDescription, setFormDescription,
    basicCardOpen, setBasicCardOpen, pricingCardOpen, setPricingCardOpen,
    discountsCardOpen, setDiscountsCardOpen, fulfillmentCardOpen, setFulfillmentCardOpen,
    attributesCardOpen, setAttributesCardOpen,
    specsDisplayCardOpen, setSpecsDisplayCardOpen, specsClothingCardOpen, setSpecsClothingCardOpen,
    specsSizeChartCardOpen, setSpecsSizeChartCardOpen, specsMonogramCardOpen, setSpecsMonogramCardOpen,
    mediaGalleryCardOpen, setMediaGalleryCardOpen, mediaPresentationCardOpen, setMediaPresentationCardOpen,
    variantsMatrixCardOpen, setVariantsMatrixCardOpen, variantsPricingCardOpen, setVariantsPricingCardOpen,
    variantsStockCardOpen, setVariantsStockCardOpen,
    formPhoto, setFormPhoto, addImageUrl, setAddImageUrl, photoInputRef,
    formImages, setFormImages, stageIndex, setStageIndex,
    mediaWide, setMediaWide, mediaCards, setMediaCards,
    dragActive, setDragActive, draggingId, setDraggingId, mediaWrapRef, dragIdRef,
    formFabricGsm, setFormFabricGsm, formCut, setFormCut, formModelDims, setFormModelDims,
    formCare, setFormCare, formMonogramEnabled, setFormMonogramEnabled,
    formMonogramChars, setFormMonogramChars, formMonogramUpcharge, setFormMonogramUpcharge,
    visibleSections, setVisibleSections,
    formVariants, setFormVariants, formAdjustments, setFormAdjustments,
    adjustmentDrafts, setAdjustmentDrafts, priceDrafts, setPriceDrafts,
  } = draftVm;
  const attrValues = (name: string) => formAttributes.find((a) => a.name === name)?.values ?? [];
  const colorValues = attrValues('Color');
  const sizeValues = attrValues('Size');
  
  const chartColumns = (chart: SizeChart) => chart.columns;

  
  const addDiscountRef = useRef<HTMLDivElement>(null);

  const openCreateDrawer = () => {
    if (!can('product.create')) return refused('create products');
    releaseUploadPreviews();
    dispatchEditor({ type: 'OPEN_CREATE' });
    setBasicCardOpen(false);
    setPricingCardOpen(false);
    setDiscountsCardOpen(false);
    setFulfillmentCardOpen(false);
    setAttributesCardOpen(false);
    setSpecsDisplayCardOpen(false);
    setSpecsClothingCardOpen(false);
    setSpecsSizeChartCardOpen(false);
    setSpecsMonogramCardOpen(false);
    setMediaGalleryCardOpen(false);
    setMediaPresentationCardOpen(false);
    setVariantsMatrixCardOpen(true);
    setVariantsPricingCardOpen(false);
    setVariantsStockCardOpen(false);
    setProductTab('general');
    setDrawerView('compact');
    autoExpandedRef.current = false;
    setStageIndex(0);
    setFormName('');
    setFormSlug('');
    setFormCategory(categories[0] ?? UNCATEGORIZED_CATEGORY);
    setFormPrice('48.00');
    setFormComparePrice('');
    setFormCompareError(null);
    setFormStock('25');
    setFormStyleCode('');
    setFormSerialNo('');
    setFormWeight('');
    setFormShipWeight('');
    setFormDims('');
    setFormGender('');
    setFormTax('');
    setFormHsn('');
    setFormDiscounts([]);
    setFormSizeChartId('');
    setFormAttributes([
      { name: 'Color', values: ['Black', 'Chalk White', 'Olive'], builtin: true, displayType: 'swatch', swatchHex: {}, libraryId: libId('Color') },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'], builtin: true, displayType: 'pill', swatchHex: {}, libraryId: libId('Size') },
      { name: 'Placements', values: ['Front'], builtin: true, displayType: 'radio', swatchHex: {}, libraryId: libId('Placements') },
    ]);
    setFormPartner('Qikink Direct API');
    setFormExchangePolicy('defects_only');
    setFormProductKind('physical');
    setFormLowStock('');
    setFormStatus('published');
    setFormDescription('Pre-shrunk premium heavyweight combed cotton with reinforced seams.');
    setFormPhoto({ layout: 'carousel', ratio: '4:3', showPhotos: true });
    setFormImages([]);
    setAddImageUrl('');
    setFormVariants([]);
    setFormAdjustments({});
    setAdjustmentDrafts({});
    setPriceDrafts({});
    setFormFabricGsm('');
    setFormCut('');
    setFormModelDims('');
    setFormCare('');
    setFormMonogramEnabled(false);
    setFormMonogramChars('3');
    setFormMonogramUpcharge('12.00');
  };

  
  const [productTab, setProductTab] = useState<'general' | 'media' | 'variants' | 'specs' | 'partner'>('general');
  
  const photoAspect = formPhoto.ratio === '1:1' ? '1 / 1' : formPhoto.ratio === '16:9' ? '16 / 9' : '4 / 3';

  const revokeUploads = (uploads: Array<{ url: string }>) => {
    uploads.forEach((u) => {
      try {
        URL.revokeObjectURL(u.url);
      } catch {
        
      }
    });
  };

  
  
  const releaseUploadPreviews = () => {
    setFormImages((prev) => {
      revokeUploads(prev.filter((im) => !im.persisted).map((im) => ({ url: im.src })));
      return prev;
    });
  };

  
  
  
  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

  const setCoverImage = (id: string) => {
    setFormImages((prev) => {
      const idx = prev.findIndex((im) => im.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      return [item, ...next];
    });
  };

  const moveImageTo = (dragId: string, targetId: string) => {
    setFormImages((prev) => {
      const from = prev.findIndex((im) => im.id === dragId);
      const to = prev.findIndex((im) => im.id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  
  
  React.useEffect(() => {
    const el = mediaWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setMediaWide(w >= 700);
      setMediaCards(w >= 1000);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [productTab]);

  
  
  
  
  const [drawerView, setDrawerView] = useState<'compact' | 'matrix' | 'full'>('compact');
  const autoExpandedRef = useRef(false);
  const prevTab = useRef<'general' | 'media' | 'variants' | 'specs' | 'partner'>('general');
  React.useEffect(() => {
    const entered = prevTab.current !== 'variants' && productTab === 'variants';
    prevTab.current = productTab;
    if (entered && drawerView === 'compact' && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setDrawerView('matrix');
    }
  }, [productTab, drawerView]);

  
  
  const closeEditor = () => {
    flushChartTimers();
    releaseUploadPreviews();
    dispatchEditor({ type: 'CLOSE' });
    setBasicCardOpen(false);
    setPricingCardOpen(false);
    setDiscountsCardOpen(false);
    setFulfillmentCardOpen(false);
    setAttributesCardOpen(false);
    setSpecsDisplayCardOpen(false);
    setSpecsClothingCardOpen(false);
    setSpecsSizeChartCardOpen(false);
    setSpecsMonogramCardOpen(false);
    setMediaGalleryCardOpen(false);
    setMediaPresentationCardOpen(false);
    setVariantsMatrixCardOpen(true);
    setVariantsPricingCardOpen(false);
    setVariantsStockCardOpen(false);
    setDrawerView('compact');
    autoExpandedRef.current = false;
  };

  const removeImage = (id: string) => {
    setFormImages((prev) => {
      const target = prev.find((im) => im.id === id);
      if (target && !target.persisted) revokeUploads([{ url: target.src }]);
      return prev.filter((im) => im.id !== id);
    });
  };

  const addImageUrlEntry = () => {
    const url = addImageUrl.trim();
    if (!url) return;
    setFormImages((prev) =>
      prev.some((im) => im.src === url) ? prev : [...prev, { id: `g-${Date.now()}`, src: url, name: baseName(url), persisted: true }]
    );
    setAddImageUrl('');
  };

  const handlePickedFiles = (files: FileList | null) => {
    if (!files) return;
    [...files].forEach((f) => {
      if (f.size > MAX_UPLOAD_BYTES) {
        showToast({
          type: 'warning',
          title: 'File Too Large',
          description: `"${f.name}" exceeds the 25MB limit and was skipped.`,
        });
        return;
      }
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        setFormImages((prev) => [...prev, { id: `up-${Date.now()}-${f.name}`, src: url, name: f.name, persisted: false }]);
      }
    });
  };
  
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('tuw_admin_v2_product_editor');
      if (raw) {
        const saved = JSON.parse(raw) as { monogram?: boolean };
        if (typeof saved.monogram === 'boolean') setVisibleSections({ monogram: saved.monogram });
      }
    } catch {
      
    }
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem('tuw_admin_v2_product_editor', JSON.stringify(visibleSections));
    } catch {
      
    }
  }, [visibleSections]);
  
  
  const setAdjustment = (key: string, amount: number | null) => {
    const nextAdj = { ...formAdjustments };
    if (amount === null) delete nextAdj[key];
    else nextAdj[key] = roundPrice(amount);
    setFormAdjustments(nextAdj);
    setFormVariants((prev) => recomputeVariants(parseFloat(formPrice) || 0, nextAdj, prev));
  };

  const writeAdjustment = (key: string, raw: string) => {
    
    
    if (!/^\d*\.?\d*$/.test(raw)) return;
    setAdjustmentDrafts((prev) => {
      const next = { ...prev };
      if (raw === '') delete next[key];
      else next[key] = raw;
      return next;
    });
    if (raw.trim() === '') {
      setAdjustment(key, null);
      return;
    }
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) setAdjustment(key, n);
    
  };

  const clearAdjustmentDraft = (key: string) => {
    setAdjustmentDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  
  
  const clearPriceDraft = (id: string) => {
    setPriceDrafts((prev) => {
      if (prev[id] === undefined) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  
  
  
  const writeBasePrice = (priceStr: string) => {
    
    
    if (!/^\d*\.?\d*$/.test(priceStr)) return;
    setFormPrice(priceStr);
    if (formCompareError) setFormCompareError(null);
    const n = parseFloat(priceStr);
    if (isNaN(n) || n < 0) return;
    setFormVariants((prev) => recomputeVariants(roundPrice(n), formAdjustments, prev));
  };

  const writeStockTotal = (stockStr: string) => {
    setFormStock(stockStr);
    const total = parseInt(stockStr, 10);
    if (isNaN(total) || total < 0) return;
    setFormVariants((prev) => {
      if (prev.length === 0) return prev;
      const base = Math.floor(total / prev.length);
      let remainder = total % prev.length;
      return prev.map((v) => {
        const add = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder -= 1;
        return { ...v, stock: base + add };
      });
    });
  };

  const rebuildMatrix = (colors: string[], sizes: string[], basePrice: number, productId: string) => {
    setFormVariants((prev) => {
      const byKey = new Map(prev.map((v) => [`${v.color}|${v.size}`, v]));
      const out: ProductVariant[] = [];
      colors.forEach((color, ci) => {
        sizes.forEach((size) => {
          const kept = byKey.get(`${color}|${size}`);
          if (kept) {
            
            out.push(
              kept.priceOverridden
                ? kept
                : { ...kept, price: deriveVariantPrice(basePrice, formAdjustments, color, size) }
            );
          } else {
            out.push({
              id: `tmp-${ci}-${size}`,
              color,
              size,
              sku: buildVariantSku(productId, ci, size),
              price: deriveVariantPrice(basePrice, formAdjustments, color, size),
              stock: 0,
            });
          }
        });
      });
      return out;
    });
  };

  
  
  
  
  const addAttrValue = (name: string) => {
    const v = (attrDrafts[name] ?? '').trim();
    if (!v) return;
    if (commitAttrValue(name, v)) {
      setAttrDrafts((prev) => ({ ...prev, [name]: '' }));
    }
  };
  
  
  
  
  const commitAttrValue = (name: string, v: string): boolean => {
    const value = v.trim();
    if (!value) return false;
    const attr = formAttributes.find((a) => a.name === name);
    if (!attr) return false;
    if (attr.values.some((x) => x.toLowerCase() === value.toLowerCase())) {
      showToast({ type: 'warning', title: 'Duplicate Value', description: `"${value}" is already a ${name} value.` });
      return false;
    }
    const next = formAttributes.map((a) => (a.name === name ? { ...a, values: [...a.values, value] } : a));
    setFormAttributes(next);
    
    
    
    
    
    if (attr.libraryId) {
      const lib = libraryAttributes.find((l) => l.id === attr.libraryId);
      const known = (lib?.values ?? []).some((x) => x.toLowerCase() === value.toLowerCase());
      if (!known) addLibraryValue(attr.libraryId, value);
    }
    if (name === 'Color' || name === 'Size') {
      const { colors, sizes } = colorsSizesOf(next);
      rebuildMatrix(colors, sizes, parseFloat(formPrice) || 0, editingProduct?.id ?? 'PRD');
    }
    return true;
  };
  const removeAttrValue = (name: string, value: string) => {
    const next = formAttributes.map((a) =>
      a.name === name ? { ...a, values: a.values.filter((x) => x !== value) } : a
    );
    setFormAttributes(next);
    
    const pruned = pruneAdjustments(formAdjustments, next);
    setFormAdjustments(pruned.next);
    if (pruned.dropped.length > 0) {
      showToast({
        type: 'info',
        title: 'Price Adjustment Cleared',
        description: `The per-value adjustment for "${value}" was removed with the value.`,
      });
    }
    if (name === 'Color' || name === 'Size') {
      const { colors, sizes } = colorsSizesOf(next);
      rebuildMatrix(colors, sizes, parseFloat(formPrice) || 0, editingProduct?.id ?? 'PRD');
    }
  };
  const addAttribute = () => {
    const name = newAttrName.trim();
    if (!name) return;
    if (formAttributes.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      showToast({ type: 'warning', title: 'Duplicate Attribute', description: `"${name}" already exists.` });
      return;
    }
    
    
    const lib = libraryAttributes.find((l) => l.name.toLowerCase() === name.toLowerCase());
    const linkedId = lib?.id ?? createLibraryAttribute(name);
    if (!linkedId) return;
    setFormAttributes((prev) => [...prev, { name, values: [], builtin: false, displayType: 'pill', swatchHex: {}, libraryId: linkedId }]);
    setNewAttrName('');
    if (!lib) {
      showToast({ type: 'info', title: 'New Library Attribute', description: `"${name}" joins the attribute library when you save this product.` });
    }
  };
  const removeAttribute = (name: string) => {
    setFormAttributes((prev) => prev.filter((a) => a.name !== name));
  };

  
  
  
  
  
  const linkFromLibrary = (libId: string) => {
    const lib = libraryAttributes.find((a) => a.id === libId);
    if (!lib) return;
    const existing = formAttributes.find((a) => a.name.toLowerCase() === lib.name.toLowerCase());
    if (existing) {
      if (!existing.libraryId) {
        setFormAttributes((prev) =>
          prev.map((a) =>
            a.name.toLowerCase() === lib.name.toLowerCase() ? { ...a, libraryId: lib.id } : a
          )
        );
      }
      showToast({ type: 'info', title: 'Already Linked', description: `"${lib.name}" is already on this product.` });
      return;
    }
    setFormAttributes((prev) => [
      ...prev,
      {
        name: lib.name,
        values: [...lib.values],
        builtin: false,
        displayType: lib.displayType,
        swatchHex: {},
        libraryId: lib.id,
      },
    ]);
    showToast({ type: 'success', title: 'Linked From Library', description: `"${lib.name}" linked with ${lib.values.length} values.` });
  };

  
  
  const addDiscount = () => {
    setFormDiscounts((prev) => [
      ...prev,
      { id: `tmp-d-${Date.now()}`, discountType: 'percent', value: 10, startsAt: '', endsAt: '', isActive: true },
    ]);
  };
  const patchDiscount = (id: string, patch: Partial<ProductDiscount>) => {
    setFormDiscounts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const removeDiscount = (id: string) => {
    setFormDiscounts((prev) => prev.filter((d) => d.id !== id));
    requestAnimationFrame(() => {
      addDiscountRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
  };
  const setSwatchHex = (name: string, value: string, hex: string) => {
    setFormAttributes((prev) =>
      prev.map((a) => (a.name === name ? { ...a, swatchHex: { ...a.swatchHex, [value]: hex } } : a))
    );
  };
  
  
  
  const libraryOf = (attr: ProductAttribute) =>
    libraryAttributes.find((l) => l.id === attr.libraryId) ??
    libraryAttributes.find((l) => l.name.toLowerCase() === attr.name.toLowerCase());
  const showsOnPdp = (attr: ProductAttribute) => {
    const lib = libraryOf(attr);
    return lib ? lib.showOnPdp : attr.name !== 'Placements';
  };
  const storefrontAttributes = formAttributes.filter((attr) => showsOnPdp(attr));
  const internalAttributes = formAttributes.filter((attr) => !showsOnPdp(attr));

  const attributeDisplayType = (attr: ProductAttribute) =>
    normalizeAttributeDisplayType(libraryOf(attr)?.displayType);

  const attributeSurfaces = (attr: ProductAttribute): string[] => {
    const lib = libraryOf(attr);
    if (!lib) return [];
    return [
      lib.showOnPdp ? 'PDP' : null,
      lib.showOnCheckout ? 'Checkout' : null,
      lib.showOnAdmin ? 'Admin' : null,
    ].filter((surface): surface is string => surface !== null);
  };

  const attributeMeta = (attr: ProductAttribute, internal: boolean) => {
    const lib = libraryOf(attr);
    const valueLabel = `${attr.values.length} value${attr.values.length === 1 ? '' : 's'}`;
    const surfaces = attributeSurfaces(attr);
    if (internal) {
      return `${valueLabel} · ${surfaces.length > 0 ? surfaces.join(' · ') : 'Internal'} · ${lib ? 'Linked' : 'Unlinked'}`;
    }
    return `${valueLabel} · ${surfaces.length > 0 ? surfaces.join(' · ') : 'PDP'} · ${lib ? 'Linked' : 'Unlinked'}`;
  };

  const renderAttributeChip = (attr: ProductAttribute, value: string, internal: boolean) => {
    const displayType = attributeDisplayType(attr);
    return (
      <span key={value} style={attributeChipStyle}>
        {!internal && displayType === 'swatch' ? (
          <input
            type="color"
            className="tuw-color-swatch"
            aria-label={`Swatch color for ${value}`}
            title={`Pick the PDP swatch color for ${value}`}
            value={attr.swatchHex[value] ?? '#D1D5DB'}
            onChange={(e) => setSwatchHex(attr.name, value, e.target.value)}
            style={{ flexShrink: 0 }}
          />
        ) : null}
        {!internal && displayType === 'radio' ? (
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid var(--tuw-border-control)',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          />
        ) : null}
        <span>{value}</span>
        <IconButton
          label={`Remove ${value} from ${attr.name}`}
          icon={<X size={11} />}
          size="sm"
          variant="ghost"
          className="tuw-danger-hover"
          onClick={() => removeAttrValue(attr.name, value)}
          style={{ width: 22, height: 22, borderRadius: 999, color: 'var(--tuw-text-secondary)' }}
        />
      </span>
    );
  };

  const renderAttributeRow = (attr: ProductAttribute, internal = false) => {
    const lib = libraryOf(attr);
    const displayType = attributeDisplayType(attr);
    const rowTitleId = `attribute-${attr.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'value'}-title`;
    const known = [...new Set([...(lib?.values ?? []), ...attr.values])];
    const missing = known.filter(
      (value) => !attr.values.some((current) => current.toLowerCase() === value.toLowerCase())
    );

    return (
      <div key={attr.name} role="group" aria-labelledby={rowTitleId} style={flatGroupStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <span
              id={rowTitleId}
              style={{ fontSize: 14, lineHeight: '22px', fontWeight: 600, color: 'var(--tuw-text-primary)' }}
            >
              {attr.name}
            </span>
            {attr.builtin ? <Badge variant="info" size="sm">Default</Badge> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {internal ? (
              !lib ? <Badge variant="warning" size="sm">Unlinked</Badge> : null
            ) : lib ? (
              <Badge variant="neutral" size="sm">{attributeDisplayLabel(displayType)}</Badge>
            ) : (
              <Badge variant="warning" size="sm">Unlinked · {attributeDisplayLabel(displayType)}</Badge>
            )}
            {!attr.builtin ? (
              <IconButton
                label={`Remove attribute ${attr.name}`}
                icon={<Trash2 size={14} />}
                size="sm"
                variant="ghost"
                className="tuw-danger-hover"
                onClick={() => removeAttribute(attr.name)}
                style={{ color: 'var(--tuw-text-secondary)' }}
              />
            ) : null}
          </div>
        </div>
        <span style={attributeMetaStyle}>{attributeMeta(attr, internal)}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {attr.values.length > 0 ? (
            attr.values.map((value) => renderAttributeChip(attr, value, internal))
          ) : (
            <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--tuw-text-secondary)' }}>
              No values yet
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Input
              aria-label={`Add ${attr.name} value`}
              placeholder={`Add ${attr.name.toLowerCase()} value…`}
              value={attrDrafts[attr.name] ?? ''}
              onChange={(e) => setAttrDrafts((prev) => ({ ...prev, [attr.name]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAttrValue(attr.name);
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            type="button"
            aria-label={`Add ${attr.name} value`}
            onClick={() => addAttrValue(attr.name)}
            disabled={(attrDrafts[attr.name] ?? '').trim() === ''}
          >
            Add
          </Button>
          {missing.length > 0 ? (
            <DropdownMenu
              ariaLabel={`Pick known ${attr.name} value`}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label={`Choose known ${attr.name} value`}
                  icon={<ChevronDown size={14} />}
                >
                  Choose known value
                </Button>
              }
              items={missing.map((value) => ({ value, label: value }))}
              onSelect={(value) => commitAttrValue(attr.name, value)}
            />
          ) : null}
        </div>
      </div>
    );
  };

  
  const openEditDrawer = async (summary: ProductItem) => {
    if (!can('product.update')) return refused('edit products');
    if (openingId) return;
    
    
    dispatchEditor({ type: 'OPEN_EDIT_START', id: summary.id });
    try {
      const result = await getProductAction({ id: summary.id });
      if (!result.ok) {
        showToast({ type: 'warning', title: 'Could Not Open Product', description: result.error.message });
        dispatchEditor({ type: 'OPEN_EDIT_FAIL' });
        return;
      }
      const { movements, ...detail } = result.data;
      const loaded = detail as unknown as ProductItem;
      setStockMovements(movements as StockMovement[]);
      loadEditDrawer(loaded);
      dispatchEditor({ type: 'OPEN_EDIT_DONE', product: loaded });
    } catch {
      showToast({ type: 'warning', title: 'Could Not Open Product', description: 'The request failed. Please try again.' });
      dispatchEditor({ type: 'OPEN_EDIT_FAIL' });
    }
  };

  
  const openedFromLink = useRef<string | null>(null);
  useEffect(() => {
    if (!openId || openedFromLink.current === openId) return;
    openedFromLink.current = openId;
    const summary = initialProducts.find((p) => p.id === openId);
    if (summary) void openEditDrawer(summary);
    
  }, [openId]);

  const loadEditDrawer = (product: ProductItem) => {
    
    
    releaseUploadPreviews();
    setBasicCardOpen(false);
    setPricingCardOpen(false);
    setDiscountsCardOpen(false);
    setFulfillmentCardOpen(false);
    setAttributesCardOpen(false);
    setSpecsDisplayCardOpen(false);
    setSpecsClothingCardOpen(false);
    setSpecsSizeChartCardOpen(false);
    setSpecsMonogramCardOpen(false);
    setMediaGalleryCardOpen(false);
    setMediaPresentationCardOpen(false);
    setVariantsMatrixCardOpen(true);
    setVariantsPricingCardOpen(false);
    setVariantsStockCardOpen(false);
    setProductTab('general');
    setFormCompareError(null);
    setDrawerView('compact');
    autoExpandedRef.current = false;
    setStageIndex(0);
    setFormPhoto(product.photoSettings ?? { layout: 'carousel', ratio: '4:3', showPhotos: true });
    setFormImages(
      product.images.map((src, i) => ({ id: `g-${i}`, src, name: baseName(src), persisted: true }))
    );
    setAddImageUrl('');
    setFormFabricGsm(product.fabricGsm || '');
    setFormCut(product.cut || '');
    setFormModelDims(product.modelDims || '');
    setFormCare(product.care || '');
    setFormMonogramEnabled(product.monogram?.enabled || false);
    setFormMonogramChars(String(product.monogram?.maxChars ?? 3));
    setFormMonogramUpcharge(product.monogram ? product.monogram.upcharge.toFixed(2) : '12.00');

    
    
    
    
    
    
    const savedAttributes: ProductAttribute[] = (product.attributes ?? []).map((a) => {
      
      
      const lib = libraryAttributes.find((l) => l.name.toLowerCase() === a.name.toLowerCase());
      const copy = { ...a } as ProductAttribute & { visibleOn?: unknown };
      delete copy.visibleOn;
      return {
        ...copy,
        libraryId: a.libraryId ?? lib?.id,
        values: [...a.values],
        swatchHex: { ...(a.swatchHex ?? {}) },
      };
    });
    const builtinAttributes: ProductAttribute[] = [
      { name: 'Color', values: [...product.colors], builtin: true, displayType: 'swatch', swatchHex: {}, libraryId: libId('Color') },
      { name: 'Size', values: [...product.sizes], builtin: true, displayType: 'pill', swatchHex: {}, libraryId: libId('Size') },
      { name: 'Placements', values: [], builtin: true, displayType: 'radio', swatchHex: {}, libraryId: libId('Placements') },
    ];
    const loadedAttributes: ProductAttribute[] = [
      ...builtinAttributes.map((base) => {
        const saved = savedAttributes.find(
          (a) => a.name.toLowerCase() === base.name.toLowerCase()
        );
        return saved ? { ...base, ...saved } : base;
      }),
      ...savedAttributes.filter(
        (a) =>
          !builtinAttributes.some(
            (base) => base.name.toLowerCase() === a.name.toLowerCase()
          )
      ),
    ];

    
    
    
    const basePrice = product.basePrice ?? product.price;
    const loadedAdjustments = pruneAdjustments(product.priceAdjustments, loadedAttributes).next;
    setFormAdjustments(loadedAdjustments);
    setAdjustmentDrafts({});
    setPriceDrafts({});
    setFormVariants(
      resolveVariants(product).map((v) =>
        v.priceOverridden !== undefined
          ? v
          : deriveVariantPrice(basePrice, loadedAdjustments, v.color, v.size) === v.price
            ? v
            : { ...v, priceOverridden: true }
      )
    );
    setFormName(product.name);
    setFormSlug(product.slug);
    setFormCategory(product.category);
    setFormPrice(product.price.toFixed(2));
    setFormComparePrice(product.compareAtPrice ? product.compareAtPrice.toFixed(2) : '');
    setFormStock(String(product.stock));
    setFormStyleCode(product.styleCode || '');
    setFormSerialNo(product.internalSerialNo !== undefined ? String(product.internalSerialNo) : '');
    setFormWeight(product.weight || '');
    setFormShipWeight(product.shippingWeight || '');
    setFormDims(product.dimensions || '');
    setFormGender(product.gender || '');
    setFormTax(product.taxRate !== undefined ? String(product.taxRate) : '');
    setFormHsn(product.hsnCode || '');
    setFormDiscounts((product.discounts ?? []).map((d) => ({ ...d })));
    setFormSizeChartId(product.sizeChartId ?? '');
    setFormAttributes(loadedAttributes);
    setFormPartner(product.partner);
    setFormExchangePolicy(product.exchangePolicy ?? 'defects_only');
    setFormProductKind(product.productKind ?? 'physical');
    setFormLowStock(product.lowStockThreshold !== undefined ? String(product.lowStockThreshold) : '');
    setFormStatus(product.publicationStatus);
    setFormDescription(product.description);
  };

  
  const revealField = (field: string) => {
    const base = field.split(/[.[]/)[0] || field;
    let tab: 'general' | 'media' | 'variants' | 'specs' = 'general';
    let opener: ((open: boolean) => void) | null = null;
    if (base.startsWith('variants') || base === 'colors' || base === 'sizes' || base === 'stock') {
      tab = 'variants';
    } else if (base === 'images' || base === 'photoSettings') {
      tab = 'media';
    } else if (['fabricGsm', 'cut', 'modelDims', 'care', 'monogram'].includes(base)) {
      tab = 'specs';
      opener = base === 'monogram' ? setSpecsMonogramCardOpen : setSpecsClothingCardOpen;
    } else if (['name', 'slug', 'description', 'styleCode', 'internalSerialNo', 'category', 'gender', 'publicationStatus', 'productKind', 'exchangePolicy'].includes(base)) {
      opener = setBasicCardOpen;
    } else if (['price', 'basePrice', 'compareAtPrice', 'taxRate', 'hsnCode', 'lowStockThreshold', 'priceAdjustments'].includes(base)) {
      opener = setPricingCardOpen;
    } else if (base === 'discounts') {
      opener = setDiscountsCardOpen;
    } else if (['partner', 'weight', 'shippingWeight', 'dimensions', 'sizeChartId'].includes(base)) {
      opener = setFulfillmentCardOpen;
    } else if (base === 'attributes') {
      opener = setAttributesCardOpen;
    } else {
      opener = setBasicCardOpen;
    }
    setProductTab(tab);
    opener?.(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const anchor = document.querySelector<HTMLElement>(`[data-field="${base}"]`);
      if (!anchor) return;
      anchor.scrollIntoView({ block: 'center' });
      const focusable = anchor.matches('input, select, textarea, button')
        ? anchor
        : anchor.querySelector<HTMLElement>('input, select, textarea, button, [tabindex="0"]');
      focusable?.focus();
    }));
  };

  const showSaveError = (error: { message: string; details: { field?: string }[] }) => {
    const fieldName = error.details[0]?.field ?? '';
    if (fieldName) revealField(fieldName);
    showToast({ type: 'warning', title: 'Not Saved', description: error.message });
  };

  
  
  const withGuard = async <T,>(
    setFlag: (value: boolean) => void,
    run: () => Promise<T>,
    failureTitle: string
  ): Promise<T | null> => {
    setFlag(true);
    try {
      return await run();
    } catch {
      showToast({ type: 'warning', title: failureTitle, description: 'The request failed. Please try again.' });
      return null;
    } finally {
      setFlag(false);
    }
  };

  const runSaveGuarded = async <T,>(
    action: SaveAction,
    run: () => Promise<T>,
    failureTitle: string
  ): Promise<T | null> => {
    dispatchAsync({ type: 'START', action });
    try {
      return await run();
    } catch {
      showToast({ type: 'warning', title: failureTitle, description: 'The request failed. Please try again.' });
      return null;
    } finally {
      dispatchAsync({ type: 'FINISH' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!isValidHsnCode(formHsn)) {
      revealField('hsnCode');
      showToast({
        type: 'warning',
        title: 'Check HSN Code',
        description: 'HSN/SAC must be 4–8 digits, or left blank.',
      });
      return;
    }
    if (isCreating) {
      const priceNum = parseFloat(formPrice) || 0;
      const stockNum = parseInt(formStock, 10) || 0;
      const compare = parseCompareAtPrice(formComparePrice, priceNum);
      if (compare.error) {
        setFormCompareError(compare.error);
        revealField('compareAtPrice');
        showToast({ type: 'warning', title: 'Check Compare-at Price', description: compare.error });
        return;
      }
      setFormCompareError(null);
      const created = await runSaveGuarded('create', () => createProductAction({
        name: formName,
        slug: formSlug,
        category: formCategory,
        price: priceNum,
        compareAtPrice: compare.value,
        stock: stockNum,
        colors: colorValues,
        sizes: sizeValues,
        styleCode: formStyleCode.trim() || undefined,
        internalSerialNo: formSerialNo.trim() !== '' ? Number(formSerialNo) : undefined,
        weight: formWeight.trim() || undefined,
        shippingWeight: formShipWeight.trim() || undefined,
        dimensions: formDims.trim() || undefined,
        gender: formGender || undefined,
        taxRate: formTax.trim() !== '' && !isNaN(parseFloat(formTax)) ? parseFloat(formTax) : undefined,
        hsnCode: formHsn.trim() || undefined,
        sizeChartId: formSizeChartId || undefined,
        exchangePolicy: formExchangePolicy,
        lowStockThreshold: formLowStock === '' ? undefined : Number(formLowStock),
        productKind: formProductKind,
        partner: formPartner,
        publicationStatus: formStatus,
        description: formDescription,
        photoSettings: formPhoto,
        discounts: formDiscounts,
        images: formImages.filter((im) => im.persisted).map((im) => im.src),
        attributes: formAttributes,
        fabricGsm: formFabricGsm || undefined,
        cut: formCut || undefined,
        modelDims: formModelDims || undefined,
        care: formCare || undefined,
        monogram: formMonogramEnabled
          ? {
              enabled: true,
              maxChars: parseInt(formMonogramChars, 10) || 3,
              upcharge: parseFloat(formMonogramUpcharge) || 0,
            }
          : undefined,
      }), 'Not Created');
      if (!created) return;
      
      if (!created.ok) return showSaveError(created.error);
      setProducts((list) => [created.data.product as unknown as ProductItem, ...list]);
      showToast({ type: 'success', title: 'Product Created', description: `"${created.data.product.name}" was saved. ${created.data.product.publicationStatus === 'published' ? storefrontNote(created.data.storefront) : 'It stays hidden until published.'}` });
      const droppedCount = formImages.filter((im) => !im.persisted).length;
      if (droppedCount > 0) {
        showToast({
          type: 'info',
          title: 'Session Previews Dropped',
          description: `${droppedCount} uploaded preview${droppedCount === 1 ? '' : 's'} can't persist as files — add URLs to keep them.`,
        });
      }
      closeEditor();
      return;
    }
    if (!editingProduct) return;

    const parsedBase = parseFloat(formPrice);
    const baseNum = roundPrice(
      !isNaN(parsedBase) && parsedBase >= 0 ? parsedBase : editingProduct.basePrice ?? editingProduct.price
    );
    
    
    
    
    const draftError = variantDraftError(formVariants);
    if (draftError) {
      showToast({ type: 'warning', title: 'Check Variants', description: draftError });
      revealField('variants');
      return;
    }
    const draftVariants = formVariants.length > 0 ? formVariants : resolveVariants(editingProduct);
    const submitVariants = recomputeVariants(baseNum, formAdjustments, draftVariants).map((v) => {
      const { priceOverridden, ...rest } = v;
      return priceOverridden ? { ...rest, priceOverridden: true as const } : rest;
    });
    const minPrice = submitVariants.length > 0 ? minFromPrice(submitVariants) : baseNum;
    const compare = parseCompareAtPrice(formComparePrice, minPrice);
    if (compare.error) {
      setFormCompareError(compare.error);
      revealField('compareAtPrice');
      showToast({ type: 'warning', title: 'Check Compare-at Price', description: compare.error });
      return;
    }
    setFormCompareError(null);
    const cleanAdjustments = pruneAdjustments(formAdjustments, formAttributes).next;

    const updated = await runSaveGuarded('update', () => updateProductAction({
      id: editingProduct.id,
      expectedUpdatedAt: editingProduct.updatedAt,
      colors: colorValues,
      sizes: sizeValues,
      stock: submitVariants.reduce((n, v) => n + v.stock, 0),
      name: formName,
      slug: formSlug,
      category: formCategory,
      price: minPrice,
      basePrice: baseNum,
      priceAdjustments: Object.keys(cleanAdjustments).length > 0 ? cleanAdjustments : undefined,
      compareAtPrice: compare.value,
      partner: formPartner,
      publicationStatus: formStatus,
      description: formDescription,
      styleCode: formStyleCode.trim() || undefined,
      internalSerialNo: formSerialNo.trim() !== '' ? Number(formSerialNo) : undefined,
      weight: formWeight.trim() || undefined,
      shippingWeight: formShipWeight.trim() || undefined,
      dimensions: formDims.trim() || undefined,
      gender: formGender || undefined,
      taxRate: formTax.trim() !== '' && !isNaN(parseFloat(formTax)) ? parseFloat(formTax) : undefined,
      hsnCode: formHsn.trim() || undefined,
      sizeChartId: formSizeChartId || undefined,
      exchangePolicy: formExchangePolicy,
      lowStockThreshold: formLowStock === '' ? undefined : Number(formLowStock),
      productKind: formProductKind,
      photoSettings: formPhoto,
      discounts: formDiscounts,
      images: formImages.filter((im) => im.persisted).map((im) => im.src),
      variants: submitVariants,
      attributes: formAttributes,
      fabricGsm: formFabricGsm || undefined,
      cut: formCut || undefined,
      modelDims: formModelDims || undefined,
      care: formCare || undefined,
      monogram: formMonogramEnabled
        ? {
            enabled: true,
            maxChars: parseInt(formMonogramChars, 10) || 3,
            upcharge: parseFloat(formMonogramUpcharge) || 0,
          }
        : undefined,
    }), 'Not Saved');
    if (!updated) return;
    if (!updated.ok) return showSaveError(updated.error);
    setProducts((list) => list.map((p) => (p.id === editingProduct.id ? (updated.data.product as unknown as ProductItem) : p)));
    showToast({ type: 'success', title: 'Product Updated', description: `Changes saved. ${storefrontNote(updated.data.storefront)}` });

    const droppedCount = formImages.filter((im) => !im.persisted).length;
    if (droppedCount > 0) {
      showToast({
        type: 'info',
        title: 'Session Previews Dropped',
        description: `${droppedCount} uploaded preview${droppedCount === 1 ? '' : 's'} can't persist as files — add URLs to keep them.`,
      });
    }

    closeEditor();
  };

  
  const updateVariant = (id: string, patch: Partial<ProductVariant>) => {
    setFormVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  
  
  
  const addVariant = () => {
    const basePrice = parseFloat(formPrice) || 0;
    setFormVariants((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        color: '',
        size: '',
        sku: '',
        price: basePrice,
        stock: 0,
      },
    ]);
  };
  const touchVariant = (id: string, patch: Partial<ProductVariant>) => {
    setFormVariants((prev) => {
      const colors = [...new Set(prev.map((v) => v.color).filter(Boolean))];
      return prev.map((v) => {
        if (v.id !== id) return v;
        const next = { ...v, ...patch };
        if (v.id.startsWith('tmp-') && (patch.color !== undefined || patch.size !== undefined)) {
          const known = colors.includes(next.color);
          next.sku = next.color && next.size
            ? buildVariantSku(editingProduct?.id ?? 'PRD', known ? colors.indexOf(next.color) : colors.length, next.size)
            : '';
          
          if (!next.priceOverridden) {
            next.price = deriveVariantPrice(parseFloat(formPrice) || 0, formAdjustments, next.color, next.size);
          }
        }
        return next;
      });
    });
  };
  const removeVariant = (id: string) => {
    setFormVariants((prev) => prev.filter((v) => v.id !== id));
  };

  
  

  
  const variantLowest = formVariants.length > 0 ? minFromPrice(formVariants) : null;
  const variantSpread = formVariants.length > 1 && new Set(formVariants.map((v) => v.price)).size > 1;

  

  
  

  
  
  
  
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    groups: ImportProductGroup[];
    
    listing: Record<string, unknown>[];
    errors: Array<{ row: number; message: string }>;
    hasCategoryColumn: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importVariantTotal =
    importPreview?.groups.reduce((total, group) => total + group.variants.length, 0) ?? 0;

  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      showToast({
        type: 'info',
        title: 'Save As CSV First',
        description: 'Binary .xls workbooks cannot be parsed — re-save the sheet as CSV and drop it here.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseCsv(String(reader.result ?? ''));
      if (grid.length < 2) {
        showToast({ type: 'warning', title: 'Empty Sheet', description: `"${file.name}" has no data rows.` });
        return;
      }

      
      
      
      const headerRowIndex = grid.findIndex((cells) => {
        const normalized = cells.map((cell) => cell.trim().toLowerCase());
        return (
          normalized.includes('style') &&
          normalized.some((cell) => ['sizes', 'size', 'base price', 'price'].includes(cell))
        );
      });
      if (headerRowIndex < 0) {
        showToast({
          type: 'warning',
          title: 'Header Row Not Found',
          description: 'Expected a Style column plus sizes or Base Price. Re-save the Final Listing sheet as CSV.',
        });
        return;
      }

      const headers = grid[headerRowIndex].map((h) => h.trim().toLowerCase());
      const col = (names: string[]) => {
        for (const n of names) {
          const i = headers.indexOf(n);
          if (i >= 0) return i;
        }
        return -1;
      };
      const cStyle = col(['style']);
      const cSerial = col(['s.no', 's no', 'serial no', 'serial number', 'sno']);
      const cSizes = col(['sizes', 'size']);
      const cColors = col(['colors', 'color']);
      const cWeight = col(['weight']);
      const cShip = col(['shipping weight', 'ship weight']);
      const cPrice = col(['base price', 'price']);
      const cPlace = col(['placements', 'placement']);
      const cDims = col(['package dimensions (lxbxh)', 'package dimensions', 'dimensions', 'package dimension']);
      const cTax = col(['tax rate', 'tax']);
      const cGender = col(['gender']);
      const cHsn = col(['hsn', 'hsn code', 'hsn/sac']);
      const cCategory = col(['category', 'product category']);
      
      
      const sheetRows: number[] = [];
      const listing = grid.slice(headerRowIndex + 1).map((cells, i) => {
        sheetRows.push(headerRowIndex + i + 2);
        const get = (c: number) => (c >= 0 ? (cells[c] ?? '').trim() : '');
        return {
          qikinkId: get(cSerial), gender: get(cGender), style: get(cStyle), sizes: get(cSizes), colors: get(cColors), placements: get(cPlace), basePriceINR: get(cPrice),
          weightGrams: get(cWeight), shippingWeightGrams: get(cShip), packageDimensionsCm: get(cDims), taxRatePercent: get(cTax), hsn: get(cHsn), category: get(cCategory),
        };
      });
      const parsed = parseQikinkListing(listing);
      const grouped = groupImportRows(parsed.rows);
      setImportPreview({
        fileName: file.name,
        groups: grouped.groups,
        listing,
        errors: [...parsed.issues, ...grouped.issues].map((issue) => ({ row: sheetRows[issue.row - 1] ?? issue.row, message: issue.message })),
        hasCategoryColumn: cCategory >= 0,
      });
    };
    reader.readAsText(file);
  };

  
  
  const applyImport = async () => {
    if (!importPreview || importPreview.groups.length === 0 || importing) return;
    if (!can('product.import')) return refused('import products');
    const result = await withGuard(setImporting, () => importListingAction({
      rows: importPreview.listing,
    }), 'Import Failed');
    if (!result) return;
    if (!result.ok) return showToast({ type: 'warning', title: 'Import Failed', description: result.error.message });
    setImportPreview(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
    const { created, updated, failedRows } = result.data;
    showToast({
      type: failedRows ? 'warning' : 'success',
      title: failedRows ? 'Import Partly Done' : 'Import Staged',
      description: `${created} new draft${created === 1 ? '' : 's'}, ${updated} already in the catalog${failedRows ? `, ${failedRows} row${failedRows === 1 ? '' : 's'} refused` : ''}. Review prices and publish each from the catalog.`,
    });
    router.refresh();
  };

  
  const gallerySlides: Array<{ type: 'image'; src: string; alt: string }> = formImages.map((im) => ({
    type: 'image' as const,
    src: assetSrc(im.src),
    alt: formName || 'Product image',
  }));

  
  const handleExportSelected = () => {
    const selected = products.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const headers = [
      'Product ID',
      'Name',
      'Slug',
      'Category',
      'Style Code',
      'Internal S.No',
      'HSN',
      'Price',
      'Stock',
      'Sold',
      'Status',
    ];
    const rows = selected.map((p) => [
      p.id,
      `"${p.name}"`,
      p.slug,
      p.category,
      p.styleCode ?? '',
      p.internalSerialNo !== undefined ? String(p.internalSerialNo) : '',
      p.hsnCode ?? '',
      p.price.toFixed(2),
      String(p.stock),
      String(p.soldCount),
      p.publicationStatus,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `tuw_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({
      type: 'success',
      title: 'Selected Products Exported',
      description: `${selected.length} product${selected.length === 1 ? '' : 's'} exported to CSV.`,
    });
    clearSelection();
  };

  const handleBulkStatus = async (status: 'published' | 'archived', label: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0 || saving) return;
    if (!can(status === 'archived' ? 'product.archive' : 'product.update')) return refused('change product status');
    const result = await runSaveGuarded('bulk-status', () => setProductsStatusAction({ ids, status }), 'Not Updated');
    if (!result) return;
    if (!result.ok) return showToast({ type: 'warning', title: 'Not Updated', description: result.error.message });
    const done = new Set(result.data.updated);
    setProducts((list) => list.map((p) => (done.has(p.id) ? { ...p, publicationStatus: status } : p)));
    if (editingProduct && done.has(editingProduct.id)) dispatchEditor({ type: 'PATCH_EDIT_PRODUCT', patch: { publicationStatus: status } });
    setPublicationFilter('all');
    setCurrentPage(1);
    const { refused: skipped } = result.data;
    showToast({
      type: skipped.length ? 'warning' : 'success',
      title: skipped.length ? 'Partly Updated' : 'Bulk Update Applied',
      description: `${done.size} product${done.size === 1 ? '' : 's'} marked ${label}.${skipped.length ? ` Skipped: ${skipped.slice(0, 3).map((x) => `${x.name} (${x.reason})`).join(', ')}${skipped.length > 3 ? ` and ${skipped.length - 3} more` : ''}.` : ''}`,
    });
    clearSelection();
  };

  const removeProducts = async (ids: string[]) => {
    if (!can('product.archive')) { refused('delete products'); return false; }
    const result = await runSaveGuarded('bulk-delete', () => deleteProductsAction({ ids }), 'Not Deleted');
    if (!result) return false;
    if (!result.ok) { showToast({ type: 'warning', title: 'Not Deleted', description: result.error.message }); return false; }
    const gone = new Set(result.data.deleted);
    setProducts((list) => list.filter((p) => !gone.has(p.id)));
    return true;
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || saving) return;
    if (!window.confirm(`Delete ${ids.length} product${ids.length === 1 ? '' : 's'} from the catalog? They disappear from the store; past orders keep their records.`)) return;
    if (!(await removeProducts(ids))) return;
    if (editingProduct && selectedIds.has(editingProduct.id)) closeEditor();
    setCurrentPage(1);
    showToast({ type: 'success', title: 'Bulk Delete Applied', description: `${ids.length} product${ids.length === 1 ? '' : 's'} removed from the catalog.` });
    clearSelection();
  };

  
  const stageIndexClamped = Math.min(stageIndex, Math.max(0, gallerySlides.length - 1));
  const stageHeader = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--tuw-text-secondary, #5D6772)' }}>
        MEDIA STAGE & LIVE PREVIEW
      </span>
      <span style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)' }}>
        {gallerySlides.length > 0 ? `${stageIndexClamped + 1} of ${gallerySlides.length} assets` : 'No assets'}
      </span>
    </div>
  );
  const stageCarousel = !formPhoto.showPhotos ? (
    <div style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)', padding: '12px 0' }}>
      Gallery hidden — shoppers see no photos until Show photos is on.
    </div>
  ) : gallerySlides.length > 0 && formPhoto.layout === 'grid' ? (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }} role="listbox" aria-label="Customer gallery grid preview">
      {gallerySlides.map((s, i) => (
        <button
          key={`${s.type}-${s.src}-${i}`}
          type="button"
          role="option"
          aria-selected={i === stageIndexClamped}
          aria-label={`Preview asset ${i + 1} of ${gallerySlides.length}`}
          onClick={() => setStageIndex(i)}
          style={{
            position: 'relative',
            padding: 0,
            borderRadius: 8,
            overflow: 'hidden',
            border: i === stageIndexClamped
              ? '2px solid var(--tuw-action-primary, #7539FF)'
              : '1px solid var(--tuw-border-subtle, #E5E7EB)',
            backgroundColor: 'var(--tuw-bg-canvas, #F7F8F9)',
            cursor: 'pointer',
            aspectRatio: photoAspect,
          }}
        >
          <ImageWithFallback
            src={s.src}
            alt={`Gallery image ${i + 1}`}
            optimized
            fill
            sizes="200px"
            fallbackTone="neutral"
            style={{ objectFit: 'cover' }}
          />
        </button>
      ))}
    </div>
  ) : gallerySlides.length > 0 ? (
    <Carousel
      ariaLabel="Customer gallery preview"
      variant={formPhoto.layout === 'spotlight' ? 'dots' : 'filmstrip'}
      aspect={photoAspect}
      slides={gallerySlides}
      index={stageIndexClamped}
      onIndexChange={setStageIndex}
    />
  ) : (
    <div style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)', padding: '12px 0' }}>
      No gallery images yet — add a URL below or upload photos.
    </div>
  );
  const assetRows = formImages.map((im, idx) => (
    <SurfaceCard
      key={im.id}
      direction="row"
      padding="10px"
      gap="12px"
      hoverable
      className={idx === 0 || draggingId === im.id ? 'tuw-stat-active' : ''}
      draggable
      onDragStart={(e) => {
        dragIdRef.current = im.id;
        setDraggingId(im.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDraggingId(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (dragIdRef.current) {
          moveImageTo(dragIdRef.current, im.id);
          dragIdRef.current = null;
        }
        setDraggingId(null);
      }}
      style={{ alignItems: 'center' }}
    >
      <span style={{ cursor: 'grab', display: 'inline-flex', color: 'var(--tuw-text-secondary, #5D6772)' }} aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <MediaFrame height={40} width={40} radius={8} style={{ flexShrink: 0 }}>
        {}
        <ImageWithFallback src={assetSrc(im.src)} alt="" optimized fill sizes="40px" fallbackTone="neutral" style={{ objectFit: 'cover' }} />
      </MediaFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tuw-text-primary, #262626)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {im.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {im.src}
        </div>
      </div>
      {idx === 0 ? (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#FFFFFF', backgroundColor: 'var(--tuw-action-primary, #7539FF)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
          COVER
        </span>
      ) : (
        <>
          {!im.persisted ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tuw-text-warning, #856300)', backgroundColor: 'var(--tuw-bg-warning, #FEFBF5)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
              Preview only
            </span>
          ) : null}
          {im.persisted ? (
            <button
              type="button"
              onClick={() => setCoverImage(im.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', padding: '4px 2px', flexShrink: 0 }}
            >
              Set Cover
            </button>
          ) : null}
        </>
      )}
      <UpliftSurface active width={28} height={28} className="tuw-danger-hover" style={{ flexShrink: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>
        <button
          type="button"
          aria-label={`Remove ${im.name}`}
          onClick={() => removeImage(im.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex' }}
        >
          <Trash2 size={14} />
        </button>
      </UpliftSurface>
    </SurfaceCard>
  ));
  
  
  
  const assetCards = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {formImages.map((im, idx) => (
        <SurfaceCard
          key={im.id}
          direction="row"
          padding="10px"
          gap="12px"
          hoverable
          className={idx === 0 || draggingId === im.id ? 'tuw-stat-active' : ''}
          draggable
          onDragStart={(e) => {
            dragIdRef.current = im.id;
            setDraggingId(im.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIdRef.current) {
              moveImageTo(dragIdRef.current, im.id);
              dragIdRef.current = null;
            }
            setDraggingId(null);
          }}
          style={{ alignItems: 'center', minWidth: 0 }}
        >
          <MediaFrame height={72} width={72} radius={8} style={{ flexShrink: 0 }}>
            <ImageWithFallback src={assetSrc(im.src)} alt="" optimized fill sizes="72px" fallbackTone="neutral" style={{ objectFit: 'cover' }} />
          </MediaFrame>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {im.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {im.src}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {idx === 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#FFFFFF', backgroundColor: 'var(--tuw-action-primary, #7539FF)', borderRadius: 4, padding: '2px 6px' }}>
                  COVER
                </span>
              ) : (
                <>
                  {!im.persisted ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tuw-text-warning, #856300)', backgroundColor: 'var(--tuw-bg-warning, #FEFBF5)', borderRadius: 4, padding: '2px 6px' }}>
                      Preview only
                    </span>
                  ) : null}
                  {im.persisted ? (
                    <button
                      type="button"
                      onClick={() => setCoverImage(im.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', padding: '4px 2px' }}
                    >
                      Set Cover
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <UpliftSurface active width={28} height={28} className="tuw-danger-hover" style={{ flexShrink: 0, color: 'var(--tuw-text-secondary, #5D6772)' }}>
            <button
              type="button"
              aria-label={`Remove ${im.name}`}
              onClick={() => removeImage(im.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'inline-flex' }}
            >
              <Trash2 size={14} />
            </button>
          </UpliftSurface>
        </SurfaceCard>
      ))}
    </div>
  );
  const panelHeader = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)' }}>
          Uploaded Assets
        </span>
        <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => photoInputRef.current?.click()}>
          Add Media
        </Button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)', margin: '4px 0 0 0' }}>
        Drag or click to reorder. Set the primary cover photo for your storefront.
      </p>
    </div>
  );
  const dropzone = (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload photos"
      className="tuw-stat-hover"
      onClick={() => photoInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          photoInputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handlePickedFiles(e.dataTransfer.files);
      }}
      style={{
        border: `1px dashed ${dragActive ? 'var(--tuw-action-primary, #7539FF)' : 'var(--tuw-border-control, #D1D5DB)'}`,
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: dragActive ? 'var(--tuw-bg-selected, #F8F5FF)' : 'transparent',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--tuw-action-primary, #7539FF)' }}>
        <Upload size={20} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tuw-text-primary, #262626)', marginTop: 8 }}>
        Click to upload photos, or drag files here
      </div>
      <div style={{ fontSize: 12, color: 'var(--tuw-text-secondary, #5D6772)', marginTop: 4 }}>
        PNG, JPG, or WEBP (Max 25MB each)
      </div>
    </div>
  );
  
  
  const presentationSection = (
    <DrawerSection title="Presentation" titleGap={10}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ViewToggle
          ariaLabel="Gallery layout"
          variant="labeled"
          options={[
            { value: 'grid', label: 'Grid', icon: <LayoutGrid size={16} /> },
            { value: 'carousel', label: 'Carousel', icon: <Images size={16} /> },
            { value: 'spotlight', label: 'Spotlight', icon: <Focus size={16} /> },
          ]}
          value={formPhoto.layout}
          onChange={(v) => setFormPhoto((prev) => ({ ...prev, layout: v as PhotoSettings['layout'] }))}
        />
        <DropdownMenu
          ariaLabel="Gallery aspect ratio"
          trigger={
            <span
              role="button"
              tabIndex={0}
              aria-label={`Gallery ratio, currently ${formPhoto.ratio}`}
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
                Ratio {formPhoto.ratio}
              </span>
              <ChevronDown size={14} color="var(--tuw-text-secondary, #5D6772)" />
            </span>
          }
          items={[
            { value: '1:1', label: 'Square 1:1' },
            { value: '4:3', label: 'Classic 4:3' },
            { value: '16:9', label: 'Wide 16:9' },
          ]}
          selectedValue={formPhoto.ratio}
          onSelect={(v) => setFormPhoto((prev) => ({ ...prev, ratio: v as PhotoSettings['ratio'] }))}
        />
        <Switch
          label="Show photos on storefront"
          description="Hidden galleries keep their assets in the draft"
          checked={formPhoto.showPhotos}
          onChange={(v) => setFormPhoto((prev) => ({ ...prev, showPhotos: v }))}
        />
      </div>
    </DrawerSection>
  );
  const addUrlRow = (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <Input
          aria-label="Image URL to add"
          placeholder="Paste image URL, then Add"
          value={addImageUrl}
          onChange={(e) => setAddImageUrl(e.target.value)}
        />
      </div>
      <Button variant="secondary" size="md" onClick={addImageUrlEntry}>
        Add
      </Button>
    </div>
  );

  const vm: EditorVm = {
    ...draftVm,
    ...catalogVm,
    showToast, drawerView, editingProduct, libraryAttributes, sizeCharts,
    stockMovements, products, chartColDrafts, setChartColDrafts,
    addDiscountRef, handleEditSubmit, writeBasePrice, writeStockTotal,
    addAttribute, linkFromLibrary, addDiscount, patchDiscount, removeDiscount,
    storefrontAttributes, internalAttributes, renderAttributeRow,
    stageHeader, stageCarousel, panelHeader, assetRows, assetCards,
    addUrlRow, dropzone, presentationSection, handlePickedFiles,
    addVariant, updateVariant, touchVariant, removeVariant,
    clearAdjustmentDraft, clearPriceDraft, writeAdjustment,
    variantLowest, variantSpread, chartColumns, createSizeChart,
    deleteSizeChart, addSizeChartRow, removeSizeChartRow,
    addSizeChartColumn, patchSizeChartCell,
    importPreview, setImportPreview, importing, importVariantTotal, applyImport,
  };

  return (
    <>
      <CatalogList
        can={can}
        refused={refused}
        csvInputRef={csvInputRef}
        handleImportFile={handleImportFile}
        openCreateDrawer={openCreateDrawer}
        products={products}
        filtersClear={filtersClear}
        lowStockCount={lowStockCount}
        draftCount={draftCount}
        outOfStockCount={outOfStockCount}
        stockFilter={stockFilter}
        publicationFilter={publicationFilter}
        setPublicationFilter={setPublicationFilter}
        clearProductFilters={clearProductFilters}
        kpiKeyDown={kpiKeyDown}
        toggleStockFilter={toggleStockFilter}
        togglePublicationFilter={togglePublicationFilter}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCat={selectedCat}
        categoryOptions={categoryOptions}
        setSelectedCat={setSelectedCat}
        view={view}
        changeView={changeView}
        filteredProducts={filteredProducts}
        paginatedProducts={paginatedProducts}
        assetSrc={assetSrc}
        openingId={openingId}
        openEditDrawer={openEditDrawer}
        selectedIds={selectedIds}
        allPageSelected={allPageSelected}
        somePageSelected={somePageSelected}
        togglePage={togglePage}
        handleExportSelected={handleExportSelected}
        handleBulkStatus={handleBulkStatus}
        handleBulkDelete={handleBulkDelete}
        toggleId={toggleId}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        setCurrentPage={setCurrentPage}
        setPageSize={setPageSize}
      />

      {}
      <Drawer
        isOpen={isEditorOpen(editorState)}
        onClose={closeEditor}
        title={editingProduct ? `Manage ${editingProduct.name}` : 'Add New Product'}
        subtitle={
          editingProduct ? (
            <span style={{ fontSize: 13, color: 'var(--tuw-text-secondary, #5D6772)' }}>
              {`ID: ${editingProduct.id} · ${editingProduct.partner} · `}
              <Badge
                variant={
                  editingProduct.publicationStatus === 'published'
                    ? 'success'
                    : editingProduct.publicationStatus === 'draft'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {editingProduct.publicationStatus === 'published' ? 'Live' : editingProduct.publicationStatus}
              </Badge>
            </span>
          ) : (
            'New catalog entry'
          )
        }
        expandable
        bodyTone={productTab === 'general' || productTab === 'specs' ? 'canvas' : 'surface'}
        view={drawerView}
        onViewChange={setDrawerView}
        headerExtra={
          <Tabs
            variant="underline"
            ariaLabel="Product editor sections"
            tabs={
              isCreating
                ? [
                    { id: 'general', label: 'General' },
                    { id: 'media', label: 'Media', badge: formImages.length },
                  ]
                : [
                    { id: 'general', label: 'General' },
                    { id: 'media', label: 'Media', badge: formImages.length },
                    { id: 'variants', label: 'Variants & Stock', badge: formVariants.length },
                    { id: 'specs', label: 'Clothing Specs' },
                    { id: 'partner', label: 'Partner SKUs' },
                  ]
            }
            activeTab={productTab}
            onChange={(id) => setProductTab(id as typeof productTab)}
          />
        }
        footer={
          isCreating ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <Button variant="secondary" size="sm" onClick={closeEditor}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleEditSubmit}>
                Create Product
              </Button>
            </div>
          ) : (
          editingProduct && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  if (window.confirm(`Delete "${editingProduct.name}" from the catalog? It disappears from the store; past orders keep their records.`)) {
                    void removeProducts([editingProduct.id]).then((ok) => {
                      if (!ok) return;
                      showToast({ type: 'info', title: 'Product Deleted', description: `"${editingProduct.name}" was removed from the catalog.` });
                      closeEditor();
                    });
                  }
                }}
              >
                Delete
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" size="sm" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleEditSubmit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )
          )
        }
      >
        {(editingProduct || isCreating) && (
          productTab === 'partner' && editingProduct ? (
            <PartnerSkuPanel productId={editingProduct.id} />
          ) : productTab === 'general' ? (
          <GeneralTab vm={vm} />
          ) : productTab === 'media' ? (
          <MediaTab vm={vm} />
          ) : productTab === 'variants' ? (
          <VariantsTab vm={vm} />
          ) : productTab === 'specs' ? (
          <SpecsTab vm={vm} />
          ) : null
        )}
      </Drawer>

      {}
      <ImportPreviewModal vm={vm} />
    </>
  );
}
