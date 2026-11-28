import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  previewUrlFor, previewImageFor, previewFamilyFor, PREVIEW_ANGLES, PREVIEW_FAMILIES,
  isPreviewAngle, validateMonogram,
} from '../src/storefront/plugins/personalization/preview-url.ts';
import { handlePreviewRequest } from '../src/storefront/plugins/personalization/previewRoute.ts';
import { personalizationReducer, initialPersonalizationState } from '../src/storefront/plugins/personalization/personalization-machine.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pluginDir = join(here, '../src/storefront/plugins/personalization');
const requestFor = (params) => new Request(`https://example.test/api/previews?${new URLSearchParams(params)}`);

test('preview URLs stay local and carry the selected angle and local image', () => {
  const image = previewImageFor('drinkware', 'Back');
  const url = previewUrlFor({
    productId: 'p1', color: 'Ivory', size: '350 ml', monogram: 'UK',
    placement: 'Front', maxChars: 3, angle: 'Back', family: 'drinkware', imageUrl: image,
  });
  assert.ok(url.startsWith('/api/previews?'));
  assert.ok(!url.startsWith('//'));
  const parsed = new URL(url, 'https://example.test');
  assert.equal(parsed.searchParams.get('m'), 'UK');
  assert.equal(parsed.searchParams.get('a'), 'Back');
  assert.equal(parsed.searchParams.get('f'), 'drinkware');
  assert.equal(parsed.searchParams.get('src'), '/images/pdp-figma/mug/handle-side.png');
  assert.equal(validateMonogram('UK', 3), null);
  assert.match(validateMonogram('ABCD', 3), /1 to 3 characters/);
});

test('product category picks a local image family', () => {
  assert.equal(previewFamilyFor({ category: 'mugs' }), 'drinkware');
  assert.equal(previewFamilyFor({ productType: 'kids-apparel', name: 'Kids Tee' }), 'kids');
  assert.equal(previewFamilyFor({ name: 'Coaster Set', productType: 'home' }), 'home');
  assert.equal(previewFamilyFor({ name: 'Heavy Tee' }), 'apparel');
  for (const family of PREVIEW_FAMILIES) {
    for (const angle of PREVIEW_ANGLES) {
      const image = previewImageFor(family, angle);
      const isAsset = image.startsWith('/api/personalization/assets/');
      assert.ok(isAsset || image.startsWith('/images/pdp-figma/'));
      const file = isAsset
        ? join(here, '..', 'src', 'storefront', 'plugins', 'personalization', 'assets', image.split('/').pop())
        : join(here, '..', 'public', image.replace(/^\//, ''));
      assert.ok(readFileSync(file).length > 0);
    }
  }
});

test('preview route composes onto a whitelisted angle image and rejects invalid paths', async () => {
  assert.deepEqual([...PREVIEW_ANGLES], ['Front', 'Back', 'Left Pocket', 'Side', 'Wrap']);
  assert.equal(isPreviewAngle('Diagonal'), false);
  const base = {
    p: 'p1', m: 'UK', mx: '3', a: 'Front', f: 'apparel',
    src: previewImageFor('apparel', 'Front'),
  };
  const ok = handlePreviewRequest(requestFor(base));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type') ?? '', /image\/svg\+xml/);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  const svg = await ok.text();
  assert.match(svg, /data:image\/(png|jpeg);base64,/);
  assert.match(svg, />UK</);
  assert.match(svg, /Front · demo preview/);

  assert.equal(handlePreviewRequest(requestFor({ ...base, a: 'Diagonal' })).status, 400);
  assert.equal(handlePreviewRequest(requestFor({ ...base, f: 'secret' })).status, 400);
  assert.equal(handlePreviewRequest(requestFor({ ...base, src: '/images/../../etc/passwd' })).status, 400);
  assert.equal(handlePreviewRequest(requestFor({ ...base, m: 'ABCD' })).status, 400);
});

test('personalization FSM still reaches approved with the angle-aware preview URL', () => {
  const preview = previewUrlFor({ productId: 'p1', monogram: 'UK', angle: 'Side', family: 'apparel' });
  const editing = personalizationReducer(initialPersonalizationState, { type: 'ENABLE' });
  assert.equal(personalizationReducer(editing, { type: 'ADD' }).kind, 'editing');
  const previewing = personalizationReducer(editing, { type: 'RENDER', previewUrl: preview });
  assert.equal(previewing.kind, 'previewing');
  const adding = personalizationReducer(previewing, { type: 'ADD' });
  assert.equal(adding.kind, 'adding');
  assert.deepEqual(personalizationReducer(adding, { type: 'APPROVED', lineId: 'line-1' }), { kind: 'approved', lineId: 'line-1' });
});

test('the panel renders the carousel with truthful demo copy', () => {
  const panel = readFileSync(join(pluginDir, 'PersonalizationPanel.tsx'), 'utf8');
  const carousel = readFileSync(join(pluginDir, 'PreviewCarousel.tsx'), 'utf8');
  assert.match(panel, /<PreviewCarousel/);
  assert.match(panel, /previewUrlFor\(\{/);
  assert.match(panel, /addingRef\.current/);
  assert.match(carousel + panel, /Demo preview generated locally — no design file is uploaded\./);
});
