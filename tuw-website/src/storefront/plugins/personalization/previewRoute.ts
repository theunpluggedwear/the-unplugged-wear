import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  escapeXml, isPreviewAngle, isPreviewFamily, isPreviewImageUrl,
  previewImageFor, printZoneFor,
} from './preview-url.ts';

const embeddedImages = new Map<string, string>();

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

function imageFor(path: string): { dataUrl: string; ext: string } {
  const cached = embeddedImages.get(path);
  if (cached) return { dataUrl: cached, ext: path.split('.').pop()?.toLowerCase() ?? 'jpg' };
  const ext = path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const key = path.startsWith('/api/personalization/assets/') ? path.split('/').pop() ?? '' : '';
  const file = key && !/^[a-zA-Z0-9_.-]+$/.test(key)
    ? ''
    : key
      ? join(process.cwd(), key.startsWith('default') || key.startsWith('Front_') || key.startsWith('Back_') || key.startsWith('Left_')
          ? 'src/storefront/plugins/personalization/assets'
          : '.data/personalization', key)
      : join(process.cwd(), 'public', path.replace(/^\/+/, ''));
  const bytes = readFileSync(file);
  const dataUrl = `data:${MIME[ext] ?? 'image/jpeg'};base64,${bytes.toString('base64')}`;
  embeddedImages.set(path, dataUrl);
  return { dataUrl, ext };
}

function invalid(): Response {
  return new Response(JSON.stringify({ error: 'Invalid preview request.' }), {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function handlePreviewRequest(request: Request): Response {
  const url = new URL(request.url);
  const productId = url.searchParams.get('p') ?? '';
  const monogram = url.searchParams.get('m') ?? '';
  const placement = url.searchParams.get('pl') ?? '';
  const color = url.searchParams.get('c') ?? '';
  const rawAngle = url.searchParams.get('a') ?? 'Front';
  const rawFamily = url.searchParams.get('f') ?? 'apparel';
  const rawImage = url.searchParams.get('src');
  const rawMaxChars = url.searchParams.get('mx');
  const maxChars = rawMaxChars === null ? 30 : Number(rawMaxChars);

  if (!isPreviewAngle(rawAngle) || !isPreviewFamily(rawFamily)) return invalid();
  const builtIn = previewImageFor(rawFamily, rawAngle);
  if (rawImage !== null && rawImage !== builtIn && !isPreviewImageUrl(rawImage)) return invalid();
  if (!productId || !monogram || !Number.isInteger(maxChars) || maxChars < 1 || maxChars > 30
    || monogram.length > maxChars || placement.length > 50 || color.length > 50) {
    return invalid();
  }

  const imagePath = rawImage ?? builtIn;
  let embedded: { dataUrl: string; ext: string };
  try {
    embedded = imageFor(imagePath);
  } catch {
    return invalid();
  }
  const zone = printZoneFor(imagePath);
  const label = escapeXml(placement || rawAngle);
  const text = escapeXml(monogram);
  const swatch = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1A1A1A';
  const captionY = zone.height + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${zone.width}" height="${zone.height + 64}" viewBox="0 0 ${zone.width} ${zone.height + 64}" role="img" aria-label="${label} ${rawAngle} demo monogram preview"><rect width="${zone.width}" height="${zone.height + 64}" fill="#FAF9F6"/><image href="${embedded.dataUrl}" x="0" y="0" width="${zone.width}" height="${zone.height}" preserveAspectRatio="xMidYMid meet"/><rect x="${zone.cover.x}" y="${zone.cover.y}" width="${zone.cover.w}" height="${zone.cover.h}" fill="#FAF9F6"/><text x="${zone.text.x}" y="${zone.text.y}" text-anchor="middle" font-family="Georgia,serif" font-size="${zone.text.size}" fill="${swatch}">${text}</text><text x="${zone.width / 2}" y="${captionY}" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#5D6772">${label} · ${rawAngle} · demo preview</text></svg>`;
  return new Response(svg, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}
