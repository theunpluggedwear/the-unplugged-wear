export type CardKey =
  | 'basic' | 'pricing' | 'discounts' | 'fulfillment' | 'attributes'
  | 'specsDisplay' | 'specsClothing' | 'specsSizeChart' | 'specsMonogram'
  | 'mediaGallery' | 'mediaPresentation'
  | 'variantsMatrix' | 'variantsPricing' | 'variantsStock';

export type CardOpen = Record<CardKey, boolean>;

export type CardTab = 'general' | 'media' | 'variants' | 'specs';

export const initialCardOpen: CardOpen = {
  basic: false,
  pricing: false,
  discounts: false,
  fulfillment: false,
  attributes: false,
  specsDisplay: false,
  specsClothing: false,
  specsSizeChart: false,
  specsMonogram: false,
  mediaGallery: false,
  mediaPresentation: false,
  variantsMatrix: true,
  variantsPricing: false,
  variantsStock: false,
};

export type CardEvent =
  | { type: 'SET'; card: CardKey; open: boolean }
  | { type: 'RESET' };

export function cardReducer(state: CardOpen, event: CardEvent): CardOpen {
  switch (event.type) {
    case 'SET':
      return state[event.card] === event.open ? state : { ...state, [event.card]: event.open };
    case 'RESET':
      return { ...initialCardOpen };
    default:
      return state;
  }
}

export function cardForField(field: string): { tab: CardTab; card?: CardKey } {
  const base = field.split(/[.[]/)[0] || field;
  if (base.startsWith('variants') || base === 'colors' || base === 'sizes' || base === 'stock') {
    return { tab: 'variants' };
  }
  if (base === 'images' || base === 'photoSettings') {
    return { tab: 'media' };
  }
  if (['fabricGsm', 'cut', 'modelDims', 'care', 'monogram'].includes(base)) {
    return { tab: 'specs', card: base === 'monogram' ? 'specsMonogram' : 'specsClothing' };
  }
  if (['name', 'slug', 'description', 'styleCode', 'internalSerialNo', 'category', 'gender', 'publicationStatus', 'productKind', 'exchangePolicy'].includes(base)) {
    return { tab: 'general', card: 'basic' };
  }
  if (['price', 'basePrice', 'compareAtPrice', 'taxRate', 'hsnCode', 'lowStockThreshold', 'priceAdjustments'].includes(base)) {
    return { tab: 'general', card: 'pricing' };
  }
  if (base === 'discounts') {
    return { tab: 'general', card: 'discounts' };
  }
  if (['partner', 'weight', 'shippingWeight', 'dimensions', 'sizeChartId'].includes(base)) {
    return { tab: 'general', card: 'fulfillment' };
  }
  if (base === 'attributes') {
    return { tab: 'general', card: 'attributes' };
  }
  return { tab: 'general', card: 'basic' };
}
