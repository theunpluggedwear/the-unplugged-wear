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

export const PREVIEW_ANGLES = ['Front', 'Back', 'Side', 'Wrap'] as const;
export type PreviewAngle = typeof PREVIEW_ANGLES[number];

export const PREVIEW_FAMILIES = ['apparel', 'drinkware', 'kids', 'home'] as const;
export type PreviewFamily = typeof PREVIEW_FAMILIES[number];

const PREVIEW_IMAGES: Record<PreviewFamily, Record<PreviewAngle, string>> = {
  apparel: {
    Front: '/images/pdp-figma/shirt/front.png',
    Back: '/images/pdp-figma/shirt/back.png',
    Side: '/images/pdp-figma/shirt/side.png',
    Wrap: '/images/pdp-figma/pairs/apparel-crewneck.png',
  },
  drinkware: {
    Front: '/images/pdp-figma/mug/front.png',
    Back: '/images/pdp-figma/mug/handle-side.png',
    Side: '/images/pdp-figma/mug/on-desk.png',
    Wrap: '/images/pdp-figma/pairs/living-sipper-bottle.png',
  },
  kids: {
    Front: '/images/pdp-figma/kids/front.png',
    Back: '/images/pdp-figma/kids/flat-lay.png',
    Side: '/images/pdp-figma/pairs/kids-kids-shorts.png',
    Wrap: '/images/pdp-figma/pairs/kids-kids-sweatshirt.png',
  },
  home: {
    Front: '/images/pdp-figma/pairs/living-coasters.png',
    Back: '/images/pdp-figma/pairs/living-steel-bottle.png',
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
