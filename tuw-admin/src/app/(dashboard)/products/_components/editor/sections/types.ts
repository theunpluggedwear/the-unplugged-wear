import React from 'react';
import type { LibraryAttribute, SizeChart } from '@tuw/heart/modules/catalog';
import type { ImportProductGroup } from '@tuw/heart/modules/catalog/planner';
import type {
  ProductItem, ProductVariant, ProductAttribute, ProductDiscount, StockMovement,
} from '@/lib/admin-dto';
import type { useToast } from '@/components/providers/ToastProvider';
import type { useProductEditorDraft } from '../useProductEditorDraft';
import type { useCatalogFilters } from '../useCatalogFilters';

export interface ImportPreview {
  fileName: string;
  groups: ImportProductGroup[];
  listing: Record<string, unknown>[];
  errors: Array<{ row: number; message: string }>;
  hasCategoryColumn: boolean;
}

export interface EditorExtraVm {
  showToast: ReturnType<typeof useToast>['showToast'];
  drawerView: 'compact' | 'matrix' | 'full';
  editingProduct: ProductItem | null;
  libraryAttributes: LibraryAttribute[];
  sizeCharts: SizeChart[];
  stockMovements: StockMovement[];
  products: ProductItem[];
  chartColDrafts: Record<string, string>;
  setChartColDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addDiscountRef: React.RefObject<HTMLDivElement | null>;
  handleEditSubmit: (e: React.FormEvent) => void;
  writeBasePrice: (priceStr: string) => void;
  writeStockTotal: (stockStr: string) => void;
  addAttribute: () => void;
  linkFromLibrary: (id: string) => void;
  addDiscount: () => void;
  patchDiscount: (id: string, patch: Partial<ProductDiscount>) => void;
  removeDiscount: (id: string) => void;
  storefrontAttributes: ProductAttribute[];
  internalAttributes: ProductAttribute[];
  renderAttributeRow: (attr: ProductAttribute, internal?: boolean) => React.ReactNode;
  stageHeader: React.ReactNode;
  stageCarousel: React.ReactNode;
  panelHeader: React.ReactNode;
  assetRows: React.ReactNode;
  assetCards: React.ReactNode;
  addUrlRow: React.ReactNode;
  dropzone: React.ReactNode;
  presentationSection: React.ReactNode;
  handlePickedFiles: (files: FileList | null) => void;
  addVariant: () => void;
  updateVariant: (id: string, patch: Partial<ProductVariant>) => void;
  touchVariant: (id: string, patch: Partial<ProductVariant>) => void;
  removeVariant: (id: string) => void;
  clearAdjustmentDraft: (key: string) => void;
  clearPriceDraft: (id: string) => void;
  writeAdjustment: (key: string, raw: string) => void;
  variantLowest: number | null;
  variantSpread: boolean;
  chartColumns: (chart: SizeChart) => string[];
  createSizeChart: (name: string) => boolean;
  deleteSizeChart: (id: string) => void;
  addSizeChartRow: (chartId: string, size: string) => boolean;
  removeSizeChartRow: (chartId: string, size: string) => boolean;
  addSizeChartColumn: (chartId: string, column: string) => boolean;
  patchSizeChartCell: (chartId: string, size: string, key: string, raw: string) => boolean;
  importPreview: ImportPreview | null;
  setImportPreview: React.Dispatch<React.SetStateAction<ImportPreview | null>>;
  importing: boolean;
  importVariantTotal: number;
  applyImport: () => void;
}

export type EditorVm = ReturnType<typeof useProductEditorDraft>
  & ReturnType<typeof useCatalogFilters>
  & EditorExtraVm;

export interface SectionProps {
  vm: EditorVm;
}
