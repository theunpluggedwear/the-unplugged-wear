export type ProductGender = 'Female' | 'Male' | 'Unisex' | 'Kids' | 'Boy' | 'Girl';

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  variantKey?: string;
  loadedStock?: number;
  price: number;
  priceOverridden?: boolean;
  stock: number;
}

export interface ProductAttribute {
  name: string;
  values: string[];
  builtin: boolean;
  displayType: 'pill' | 'swatch' | 'radio';
  swatchHex: Record<string, string>;
  libraryId?: string;
}

export interface PhotoSettings {
  layout: 'grid' | 'carousel' | 'spotlight';
  ratio: '1:1' | '4:3' | '16:9';
  showPhotos: boolean;
}

export interface ProductDiscount {
  id: string;
  discountType: 'percent' | 'fixed';
  value: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  qtyChange: number;
  reason: 'sale' | 'restock' | 'import' | 'admin_adjustment' | 'return' | 'cancel';
  qtyAfter: number;
  createdAt: string;
}

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  basePrice?: number;
  priceAdjustments?: Record<string, number>;
  stock: number;
  madeToOrder?: boolean;
  priceSpread?: boolean;
  updatedAt?: string;
  exchangePolicy?: 'defects_only' | 'exchangeable' | 'none';
  lowStockAt?: number;
  lowStockThreshold?: number;
  productKind?: 'physical' | 'gift_card';
  publicationStatus: 'published' | 'draft' | 'archived';
  description: string;
  colors: string[];
  sizes: string[];
  partner: 'Qikink Direct API' | 'Printrove Hub' | 'Custom Atelier';
  soldCount: number;
  images: string[];
  rating: number;
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  fabricGsm?: string;
  cut?: string;
  modelDims?: string;
  care?: string;
  styleCode?: string;
  internalSerialNo?: number;
  sourceGroupKey?: string;
  weight?: string;
  shippingWeight?: string;
  dimensions?: string;
  gender?: ProductGender;
  taxRate?: number;
  hsnCode?: string;
  sizeChartId?: string;
  discounts?: ProductDiscount[];
  monogram?: { enabled: boolean; maxChars: number; upcharge: number };
  photoSettings?: PhotoSettings;
}

export interface CollectionItem {
  id: string;
  name: string;
  slug: string;
  season: string;
  productIds: string[];
  visibility: 'published' | 'draft' | 'scheduled';
  publishedAt?: string;
  updatedAt: string;
  description: string;
}
