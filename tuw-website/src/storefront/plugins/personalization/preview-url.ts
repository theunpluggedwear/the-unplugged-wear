export interface PreviewInput {
  productId: string;
  color?: string;
  size?: string;
  monogram: string;
  placement?: string;
  maxChars?: number;
  angle?: string;
  family?: string;
  imageUrl?: string;
}

export const PREVIEW_ANGLES = ['Front', 'Back', 'Left Pocket', 'Side', 'Wrap'] as const;
export type PreviewAngle = typeof PREVIEW_ANGLES[number];

export const PREVIEW_FAMILIES = ['apparel', 'drinkware', 'kids', 'home'] as const;
export type PreviewFamily = typeof PREVIEW_FAMILIES[number];

const PREVIEW_IMAGES: Record<PreviewFamily, Record<PreviewAngle, string>> = {
  apparel: {
    Front: '/api/personalization/assets/default.jpg',
    Back: '/api/personalization/assets/Back_2_c_1.jpg',
    'Left Pocket': '/api/personalization/assets/Left_Pocket_3_c_1.jpg',
    Side: '/images/pdp-figma/shirt/side.png',
    Wrap: '/images/pdp-figma/pairs/apparel-crewneck.png',
  },
  drinkware: {
    Front: '/images/pdp-figma/mug/front.png',
    Back: '/images/pdp-figma/mug/handle-side.png',
    'Left Pocket': '/images/pdp-figma/mug/front.png',
    Side: '/images/pdp-figma/mug/on-desk.png',
    Wrap: '/images/pdp-figma/pairs/living-sipper-bottle.png',
  },
  kids: {
    Front: '/images/pdp-figma/kids/front.png',
    Back: '/images/pdp-figma/kids/flat-lay.png',
    'Left Pocket': '/images/pdp-figma/kids/chest-print.png',
    Side: '/images/pdp-figma/pairs/kids-kids-shorts.png',
    Wrap: '/images/pdp-figma/pairs/kids-kids-sweatshirt.png',
  },
  home: {
    Front: '/images/pdp-figma/pairs/living-coasters.png',
    Back: '/images/pdp-figma/pairs/living-steel-bottle.png',
    'Left Pocket': '/images/pdp-figma/pairs/living-coasters.png',
    Side: '/images/pdp-figma/pairs/living-tumbler-bottle.png',
    Wrap: '/images/pdp-figma/mug/print-detail.png',
  },
};

export function isPreviewAngle(value: string): value is PreviewAngle {
  return (PREVIEW_ANGLES as readonly string[]).includes(value);
}

export function isPreviewFamily(value: string): value is PreviewFamily {
  return (PREVIEW_FAMILIES as readonly string[]).includes(value);
}

export function previewImageFor(family: PreviewFamily, angle: PreviewAngle): string {
  return PREVIEW_IMAGES[family][angle];
}

export interface PrintZone {
  width: number;
  height: number;
  cover: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; size: number };
}

const PRINT_ZONES: Record<string, PrintZone> = {
  'default.jpg': { width: 680, height: 886, cover: { x: 260, y: 376, w: 162, h: 198 }, text: { x: 341, y: 470, size: 34 } },
  'Front_1_c_1.jpg': { width: 680, height: 886, cover: { x: 260, y: 376, w: 162, h: 198 }, text: { x: 341, y: 470, size: 34 } },
  'Back_2_c_1.jpg': { width: 680, height: 886, cover: { x: 268, y: 352, w: 156, h: 168 }, text: { x: 346, y: 445, size: 34 } },
  'Left_Pocket_3_c_1.jpg': { width: 680, height: 886, cover: { x: 434, y: 286, w: 104, h: 116 }, text: { x: 486, y: 352, size: 17 } },
};

export function printZoneFor(imageUrl: string): PrintZone {
  const key = imageUrl.split('/').pop()?.split('?')[0] ?? '';
  return PRINT_ZONES[key] ?? {
    width: 800, height: 1000,
    cover: { x: 300, y: 380, w: 200, h: 220 },
    text: { x: 400, y: 490, size: 42 },
  };
}

export function isPreviewImageUrl(value: string): boolean {
  return value.startsWith('/api/personalization/assets/') || value.startsWith('/images/');
}

export interface PreviewFamilyInput {
  category?: string;
  productType?: string;
  name?: string;
  image?: string;
}

export function previewFamilyFor(input: PreviewFamilyInput = {}): PreviewFamily {
  const haystack = [input.category, input.productType, input.name, input.image].join(' ').toLowerCase();
  if (/kid|romper|hoodie|sweatshirt/.test(haystack) && /kid/.test(haystack)) return 'kids';
  if (/mug|drinkware|bottle|tumbler|sipper|steel/.test(haystack)) return 'drinkware';
  if (/coaster|tote|home|accessor|stationery/.test(haystack)) return 'home';
  return 'apparel';
}

export function previewUrlFor(input: PreviewInput): string {
  const params = new URLSearchParams({
    p: input.productId,
    c: input.color ?? '',
    s: input.size ?? '',
    m: input.monogram,
    pl: input.placement ?? '',
    a: input.angle ?? 'Front',
    f: input.family ?? 'apparel',
  });
  if (input.maxChars !== undefined) params.set('mx', String(input.maxChars));
  if (input.imageUrl) params.set('src', input.imageUrl);
  return `/api/previews?${params.toString()}`;
}

export function validateMonogram(value: string, maxChars: number): string | null {
  const text = value.trim();
  if (!text || text.length > maxChars) return `Use 1 to ${maxChars} characters.`;
  return null;
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}
