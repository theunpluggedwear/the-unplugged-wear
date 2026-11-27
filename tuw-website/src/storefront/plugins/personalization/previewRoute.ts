import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  escapeXml, isPreviewAngle, isPreviewFamily, previewImageFor,
} from './preview-url.ts';

const embeddedImages = new Map<string, string>();

function embeddedImage(imagePath: string): string {
  const cached = embeddedImages.get(imagePath);
  if (cached) return cached;
  const file = join(process.cwd(), 'public', imagePath.replace(/^\/+/, ''));
  const dataUrl = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  embeddedImages.set(imagePath, dataUrl);
  return dataUrl;
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
  if (rawImage !== null && rawImage !== previewImageFor(rawFamily, rawAngle)) return invalid();
  if (!productId || !monogram || !Number.isInteger(maxChars) || maxChars < 1 || maxChars > 30
    || monogram.length > maxChars || placement.length > 50 || color.length > 50) {
    return invalid();
  }

  const angleImage = previewImageFor(rawFamily, rawAngle);
  const label = escapeXml(placement || 'Front');
  const text = escapeXml(monogram);
  const swatch = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1A1A1A';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="${label} ${rawAngle} demo monogram preview"><rect width="480" height="480" fill="#FAF9F6"/><image href="${embeddedImage(angleImage)}" x="40" y="40" width="400" height="400" preserveAspectRatio="xMidYMid meet"/><rect x="96" y="336" width="288" height="76" rx="12" fill="#FAF9F6" fill-opacity="0.94"/><text x="240" y="388" text-anchor="middle" font-family="Georgia,serif" font-size="38" fill="${swatch}">${text}</text><text x="240" y="466" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#5D6772">${label} · ${rawAngle} · demo preview</text></svg>`;
  return new Response(svg, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}
