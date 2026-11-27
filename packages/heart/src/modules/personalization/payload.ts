import { AppError } from '../../platform/errors/index.ts';
import type { QikinkDemoTemplate, QikinkPlacementCode, QikinkPrintTypeId } from './templates.ts';

export interface QikinkDesign {
  design_code: string;
  width_inches: number;
  height_inches: number;
  placement_sku: QikinkPlacementCode;
  design_link: string;
  mockup_link: string;
}

export interface PersonalizationDesignPayload {
  search_from_my_products: 0;
  print_type_id: QikinkPrintTypeId;
  designs: QikinkDesign[];
}

export interface DesignPayloadLine {
  sku?: string;
  payload?: Record<string, unknown> | null;
}

const PLACEMENTS = new Set<string>(['fr', 'bk', 'lp', 'rp', 'ls', 'rs']);
const PRINT_TYPES = new Set<number>([1, 3, 5, 23]);
const DESIGN_KEYS = [
  'designCode', 'design_code', 'designLink', 'design_link', 'mockupLink', 'mockup_link',
  'placement', 'placementSku', 'placement_sku', 'widthInches', 'width_inches',
  'heightInches', 'height_inches', 'previewImageUrl', 'preview_image_url',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function isDemoPreview(url: string): boolean {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
    && !/\s/.test(url) && url.length <= 2048;
}

export function qikinkRealMode(): boolean {
  return Boolean(process.env.QIKINK_CLIENT_ID?.trim() && process.env.QIKINK_CLIENT_SECRET?.trim());
}

const rawValue = (source: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const stringValue = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  const value = rawValue(source, keys);
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const numberValue = (source: Record<string, unknown>, keys: readonly string[]): number | null => {
  const value = rawValue(source, keys);
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

function checkUrl(value: string, field: string, realMode: boolean): void {
  if (/^https:\/\/[^\s/?#]+/i.test(value) && !/\s/.test(value) && value.length <= 2048) return;
  if (realMode) {
    throw new AppError('VALIDATION_FAILED', `Qikink ${field} must be a public https URL. A demo preview cannot be sent with keys configured.`, [{ field, message: 'Use a public https URL.' }]);
  }
  if (isDemoPreview(value)) return;
  throw new AppError('VALIDATION_FAILED', `Qikink ${field} must be an https URL or a demo preview path starting with a single "/".`,
    [{ field, message: 'Use https://… or a local /images/… demo preview.' }]);
}

function designFrom(source: unknown, realMode: boolean): QikinkDesign {
  if (!isRecord(source)) throw new AppError('VALIDATION_FAILED', 'Qikink design entries must be objects.');
  const missing: string[] = [];
  const designCode = stringValue(source, ['design_code', 'designCode', 'code']);
  const designLink = stringValue(source, ['design_link', 'designLink'])
    ?? stringValue(source, ['preview_image_url', 'previewImageUrl']);
  const mockupLink = stringValue(source, ['mockup_link', 'mockupLink'])
    ?? stringValue(source, ['preview_image_url', 'previewImageUrl']);
  const placement = stringValue(source, ['placement_sku', 'placementSku', 'placement']);
  const width = numberValue(source, ['width_inches', 'widthInches', 'width']);
  const height = numberValue(source, ['height_inches', 'heightInches', 'height']);
  if (!designCode) missing.push('design_code');
  else if (designCode.length > 20) missing.push('design_code must be at most 20 characters');
  if (!designLink) missing.push('design_link');
  if (!mockupLink) missing.push('mockup_link');
  if (!placement || !PLACEMENTS.has(placement)) missing.push('placement_sku must be one of fr, bk, lp, rp, ls, rs');
  if (width === null || width <= 0) missing.push('width_inches');
  if (height === null || height <= 0) missing.push('height_inches');
  if (missing.length) throw new AppError('VALIDATION_FAILED', `Qikink design needs ${missing.join(', ')}.`, [{ field: 'designs', message: missing.join(', ') }]);
  if (designLink) checkUrl(designLink, 'design_link', realMode);
  if (mockupLink) checkUrl(mockupLink, 'mockup_link', realMode);
  return {
    design_code: designCode!,
    width_inches: width!,
    height_inches: height!,
    placement_sku: placement as QikinkPlacementCode,
    design_link: designLink!,
    mockup_link: mockupLink!,
  };
}

export function hasPersonalizationDesignFields(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  if (Array.isArray(payload.designs) && payload.designs.length) return true;
  const nested = isRecord(payload.personalization) ? payload.personalization : null;
  return DESIGN_KEYS.some((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== ''
    || Boolean(nested && nested[key] !== undefined && nested[key] !== null && nested[key] !== ''));
}

export function personalizationDesignPayload(
  line: DesignPayloadLine,
  options: { realMode?: boolean } = {},
): PersonalizationDesignPayload | null {
  const payload = isRecord(line.payload) ? line.payload : {};
  const nested = isRecord(payload.personalization) ? payload.personalization : {};
  const source = { ...nested, ...payload };
  const realMode = options.realMode ?? qikinkRealMode();
  const storeSku = numberValue(source, ['search_from_my_products', 'searchFromMyProducts']);
  if (storeSku === 1) return null;

  const entries = Array.isArray(payload.designs) && payload.designs.length
    ? payload.designs
    : Array.isArray(nested.designs) && nested.designs.length
      ? nested.designs
      : hasPersonalizationDesignFields(payload) ? [source] : [];
  if (!entries.length) return null;

  const rawPrint = rawValue(source, ['print_type_id', 'printTypeId']);
  const printTypeId = rawPrint === undefined ? 1 : Number(rawPrint);
  if (!PRINT_TYPES.has(printTypeId)) {
    throw new AppError('VALIDATION_FAILED', `Qikink print_type_id ${String(rawPrint)} is not supported.`, [{ field: 'printTypeId', message: 'Use 1, 3, 5 or 23.' }]);
  }
  return {
    search_from_my_products: 0,
    print_type_id: printTypeId as QikinkPrintTypeId,
    designs: entries.map((entry) => designFrom(entry, realMode)),
  };
}

export function designFieldsFromOrderItem(input: {
  orderItemId: string;
  personalization: Record<string, unknown> | null;
  previewImageUrl?: string | null;
  template?: QikinkDemoTemplate | null;
}): Record<string, unknown> {
  const personalization = isRecord(input.personalization) ? input.personalization : {};
  const template = input.template ?? null;
  const preview = stringValue(personalization, ['previewImageUrl', 'preview_image_url']) ?? input.previewImageUrl ?? null;
  const code = stringValue(personalization, ['designCode', 'design_code'])
    ?? `TUW-${input.orderItemId.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase()}`;
  const placement = stringValue(personalization, ['placementSku', 'placement_sku', 'placement'])
    ?? template?.placement_skus[0] ?? 'fr';
  const width = numberValue(personalization, ['widthInches', 'width_inches']) ?? template?.width_inches ?? null;
  const height = numberValue(personalization, ['heightInches', 'height_inches']) ?? template?.height_inches ?? null;
  const printTypeId = numberValue(personalization, ['printTypeId', 'print_type_id']) ?? template?.print_type_id ?? null;
  return {
    designCode: code,
    ...(stringValue(personalization, ['designLink', 'design_link']) ? { designLink: stringValue(personalization, ['designLink', 'design_link']) } : preview ? { designLink: preview } : {}),
    ...(stringValue(personalization, ['mockupLink', 'mockup_link']) ? { mockupLink: stringValue(personalization, ['mockupLink', 'mockup_link']) } : preview ? { mockupLink: preview } : {}),
    placementSku: placement,
    ...(width !== null ? { widthInches: width } : {}),
    ...(height !== null ? { heightInches: height } : {}),
    ...(printTypeId !== null ? { printTypeId } : {}),
  };
}
