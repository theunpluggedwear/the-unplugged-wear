import type { ProductType } from '../catalog/read.ts';

export type QikinkPlacementCode = 'fr' | 'bk' | 'lp' | 'rp' | 'ls' | 'rs';
export type QikinkPrintTypeId = 1 | 3 | 5 | 23;
export type TemplateCategory = Extract<ProductType,
  | 'apparel' | 'kids-apparel' | 'drinkware' | 'bag'
  | 'phone-case' | 'stationery' | 'home' | 'pet'>;

export interface QikinkDemoTemplate {
  readonly demo: true;
  readonly print_type_id: QikinkPrintTypeId;
  readonly placement_skus: readonly QikinkPlacementCode[];
  readonly width_inches: number;
  readonly height_inches: number;
  readonly mockups: readonly { readonly placement_sku: QikinkPlacementCode; readonly url: string }[];
}

export const demoTemplates: Readonly<Record<TemplateCategory, QikinkDemoTemplate>> = {
  apparel: {
    demo: true,
    print_type_id: 1,
    placement_skus: ['fr', 'bk', 'lp', 'rp', 'ls', 'rs'],
    width_inches: 12,
    height_inches: 16,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/shirt/front.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/shirt/back.png' },
      { placement_sku: 'ls', url: '/images/pdp-figma/shirt/side.png' },
      { placement_sku: 'lp', url: '/images/pdp-figma/pairs/apparel-crewneck.png' },
      { placement_sku: 'rp', url: '/images/pdp-figma/pairs/apparel-heavy-tee.png' },
    ],
  },
  'kids-apparel': {
    demo: true,
    print_type_id: 1,
    placement_skus: ['fr', 'bk', 'lp', 'rp', 'ls', 'rs'],
    width_inches: 8,
    height_inches: 10,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/kids/front.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/kids/flat-lay.png' },
      { placement_sku: 'lp', url: '/images/pdp-figma/kids/chest-print.png' },
      { placement_sku: 'rp', url: '/images/pdp-figma/pairs/kids-kids-hoodie.png' },
      { placement_sku: 'ls', url: '/images/pdp-figma/pairs/kids-kids-sweatshirt.png' },
      { placement_sku: 'rs', url: '/images/pdp-figma/pairs/kids-rompers.png' },
    ],
  },
  drinkware: {
    demo: true,
    print_type_id: 23,
    placement_skus: ['fr', 'bk', 'rp', 'ls'],
    width_inches: 8,
    height_inches: 7,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/mug/front.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/mug/handle-side.png' },
      { placement_sku: 'rp', url: '/images/pdp-figma/mug/on-desk.png' },
      { placement_sku: 'ls', url: '/images/pdp-figma/pairs/living-sipper-bottle.png' },
    ],
  },
  bag: {
    demo: true,
    print_type_id: 5,
    placement_skus: ['fr', 'bk', 'lp'],
    width_inches: 10,
    height_inches: 12,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/pairs/apparel-heavy-tee.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/shirt/back.png' },
      { placement_sku: 'lp', url: '/images/pdp-figma/pairs/apparel-crewneck.png' },
    ],
  },
  'phone-case': {
    demo: true,
    print_type_id: 5,
    placement_skus: ['fr', 'bk'],
    width_inches: 6,
    height_inches: 4,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/pairs/living-coasters.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/mug/print-detail.png' },
    ],
  },
  stationery: {
    demo: true,
    print_type_id: 23,
    placement_skus: ['fr', 'bk'],
    width_inches: 6,
    height_inches: 6,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/pairs/living-coasters.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/mug/print-detail.png' },
    ],
  },
  home: {
    demo: true,
    print_type_id: 23,
    placement_skus: ['fr', 'bk', 'lp'],
    width_inches: 8,
    height_inches: 8,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/pairs/living-coasters.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/mug/on-desk.png' },
      { placement_sku: 'lp', url: '/images/pdp-figma/pairs/living-steel-bottle.png' },
    ],
  },
  pet: {
    demo: true,
    print_type_id: 1,
    placement_skus: ['fr', 'bk'],
    width_inches: 8,
    height_inches: 8,
    mockups: [
      { placement_sku: 'fr', url: '/images/pdp-figma/pairs/kids-rompers.png' },
      { placement_sku: 'bk', url: '/images/pdp-figma/kids/flat-lay.png' },
    ],
  },
};

export function demoTemplateFor(category: string | null | undefined): QikinkDemoTemplate | null {
  if (!category) return null;
  return demoTemplates[category as TemplateCategory] ?? null;
}
