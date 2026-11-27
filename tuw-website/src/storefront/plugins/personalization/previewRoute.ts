import { NextResponse } from 'next/server';
import { escapeXml } from './preview-url';

export function handlePreviewRequest(request: Request): Response {
  const url = new URL(request.url);
  const productId = url.searchParams.get('p') ?? '';
  const monogram = url.searchParams.get('m') ?? '';
  const placement = url.searchParams.get('pl') ?? '';
  const color = url.searchParams.get('c') ?? '';
  if (!productId || !monogram || monogram.length > 30 || placement.length > 50 || color.length > 50) {
    return NextResponse.json({ error: 'Invalid preview request.' }, { status: 400 });
  }
  const label = escapeXml(placement || 'Front');
  const text = escapeXml(monogram);
  const swatch = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#1A1A1A';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="Monogram preview"><rect width="480" height="480" fill="#FAF9F6"/><rect x="40" y="40" width="400" height="400" rx="24" fill="${swatch}"/><text x="240" y="270" text-anchor="middle" font-family="Georgia,serif" font-size="96" fill="#FAF9F6">${text}</text><text x="240" y="430" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#5D6772">${label} · demo preview</text></svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' },
  });
}
