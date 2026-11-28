export const PERSONALIZATION_SETTINGS_KEY = 'personalization';

export const PREVIEW_ANGLES = ['Front', 'Back', 'Side', 'Wrap'] as const;
export const PLACEMENT_CODES = ['fr', 'bk', 'lp', 'rp', 'ls', 'rs'] as const;
export const PRINT_TYPES = [1, 3, 5, 23] as const;

export interface PreviewTemplate {
  angle: string;
  imagePath: string;
  printType: number;
  placementCode: string;
  widthInches: number;
  heightInches: number;
}

export interface CategoryPreviewSettings {
  templates: PreviewTemplate[];
}

export interface QikinkMode {
  simulated: boolean;
  configured: boolean;
  notice: string;
}

export const emptyPreviewSettings = (): CategoryPreviewSettings => ({ templates: [] });

export function isSafePreviewImagePath(value: string): boolean {
  const path = String(value ?? '').trim();
  return path.length > 0 && path.length <= 2048
    && /^\/images\/pdp-figma\/[A-Za-z0-9._/-]+$/.test(path)
    && !path.includes('..')
    && !path.includes('//');
}

const text = (value: unknown, fallback: string, max: number): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
};

const numberIn = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
};

export function normalizePreviewTemplate(value: unknown): PreviewTemplate {
  const source = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const rawPrint = source.printType ?? source.print_type_id ?? source.printTypeId;
  const parsedPrint = typeof rawPrint === 'number' ? rawPrint : typeof rawPrint === 'string' ? Number(rawPrint.trim()) : NaN;
  const printType = PRINT_TYPES.includes(parsedPrint as (typeof PRINT_TYPES)[number]) ? parsedPrint : 1;
  const placement = text(source.placementCode ?? source.placement_sku ?? source.placementSku, 'fr', 10).toLowerCase();
  const angle = text(source.angle, 'Front', 40);
  const imagePath = text(source.imagePath ?? source.image_url ?? source.url, '', 2048);
  return {
    angle: PREVIEW_ANGLES.includes(angle as (typeof PREVIEW_ANGLES)[number]) ? angle : angle.slice(0, 40),
    imagePath: isSafePreviewImagePath(imagePath) ? imagePath : '',
    printType,
    placementCode: PLACEMENT_CODES.includes(placement as (typeof PLACEMENT_CODES)[number]) ? placement : 'fr',
    widthInches: numberIn(source.widthInches ?? source.width_inches, 12, 0.1, 100),
    heightInches: numberIn(source.heightInches ?? source.height_inches, 16, 0.1, 100),
  };
}

export function normalizePreviewSettings(value: unknown): CategoryPreviewSettings {
  const source = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const raw = Array.isArray(source.templates) ? source.templates : [];
  return { templates: raw.slice(0, 24).map(normalizePreviewTemplate) };
}

export function readPersonalizationSettings(settings: unknown): CategoryPreviewSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return emptyPreviewSettings();
  const raw = (settings as Record<string, unknown>)[PERSONALIZATION_SETTINGS_KEY];
  return normalizePreviewSettings(raw);
}

export function withPersonalizationSettings(
  settings: Record<string, unknown>,
  value: CategoryPreviewSettings | null,
): Record<string, unknown> {
  const { [PERSONALIZATION_SETTINGS_KEY]: _removed, ...rest } = settings;
  if (!value || !value.templates.length) return rest;
  return { ...rest, [PERSONALIZATION_SETTINGS_KEY]: normalizePreviewSettings(value) };
}

export function publicQikinkMode(health: { simulated: boolean; configured: boolean }): QikinkMode {
  const simulated = Boolean(health.simulated);
  return {
    simulated,
    configured: Boolean(health.configured),
    notice: simulated
      ? 'Simulator mode — no Qikink keys in env, so no order leaves the app.'
      : 'Qikink API mode — credentials are configured server-side and are never shown here.',
  };
}
