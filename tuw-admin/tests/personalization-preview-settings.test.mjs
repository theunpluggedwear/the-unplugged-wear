import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONALIZATION_SETTINGS_KEY,
  isSafePreviewImagePath,
  normalizePreviewSettings,
  normalizePreviewTemplate,
  publicQikinkMode,
  readPersonalizationSettings,
  withPersonalizationSettings,
} from '../src/plugins/personalization/preview-settings.ts';

const template = {
  angle: 'Front',
  imagePath: '/images/pdp-figma/shirt/front.png',
  printType: 1,
  placementCode: 'fr',
  widthInches: 12,
  heightInches: 16,
};

describe('category preview settings JSON', () => {
  test('stores templates only under the personalization namespace', () => {
    const current = { megamenuColumns: 4, hero: { title: 'Slow living' } };
    const next = withPersonalizationSettings(current, { templates: [template] });
    assert.equal(Object.keys(next).sort().join(','), 'hero,megamenuColumns,personalization');
    assert.deepEqual(next.megamenuColumns, 4);
    assert.deepEqual(next[PERSONALIZATION_SETTINGS_KEY], { templates: [template] });
    assert.equal(JSON.stringify(next).includes('"angle"'), true);
  });

  test('removal is a namespace delete and leaves sibling settings intact', () => {
    const saved = withPersonalizationSettings({ theme: 'calm' }, { templates: [template] });
    const removed = withPersonalizationSettings(saved, null);
    assert.deepEqual(removed, { theme: 'calm' });
    assert.equal(PERSONALIZATION_SETTINGS_KEY in removed, false);
    assert.deepEqual(readPersonalizationSettings(removed), { templates: [] });
  });

  test('empty templates are not persisted as an empty namespace', () => {
    assert.deepEqual(withPersonalizationSettings({ a: 1 }, { templates: [] }), { a: 1 });
  });

  test('reads the namespace from untrusted jsonb without throwing', () => {
    assert.deepEqual(readPersonalizationSettings(null), { templates: [] });
    assert.deepEqual(readPersonalizationSettings({ personalization: { nope: true } }), { templates: [] });
    assert.deepEqual(readPersonalizationSettings({ personalization: { templates: [template] } }), { templates: [template] });
  });

  test('normalises dimensions, print type and placement code', () => {
    const value = normalizePreviewTemplate({
      angle: 'Side',
      imagePath: '/images/pdp-figma/mug/front.png',
      printType: 99,
      placementCode: 'bad',
      widthInches: 400,
      heightInches: 'not a number',
    });
    assert.equal(value.printType, 1);
    assert.equal(value.placementCode, 'fr');
    assert.equal(value.widthInches, 100);
    assert.equal(value.heightInches, 16);
    assert.equal(value.imagePath, '/images/pdp-figma/mug/front.png');
  });

  test('drops unsafe image paths and accepts snake_case aliases', () => {
    assert.equal(isSafePreviewImagePath('javascript:alert(1)'), false);
    assert.equal(isSafePreviewImagePath('/images/pdp-figma/../secret.png'), false);
    assert.equal(isSafePreviewImagePath('//cdn.example.com/x.png'), false);
    const value = normalizePreviewTemplate({ print_type_id: 23, placement_sku: 'bk', width_inches: 8, height_inches: 7, url: '/images/pdp-figma/mug/front.png' });
    assert.deepEqual(value, {
      angle: 'Front',
      imagePath: '/images/pdp-figma/mug/front.png',
      printType: 23,
      placementCode: 'bk',
      widthInches: 8,
      heightInches: 7,
    });
  });

  test('caps the number of saved templates', () => {
    const settings = normalizePreviewSettings({ templates: Array.from({ length: 50 }, () => template) });
    assert.equal(settings.templates.length, 24);
  });
});

describe('Qikink mode notice', () => {
  test('says simulator when no keys are configured', () => {
    const mode = publicQikinkMode({ simulated: true, configured: false });
    assert.equal(mode.simulated, true);
    assert.match(mode.notice, /Simulator/);
  });

  test('describes the API mode without exposing credentials or URLs', () => {
    const health = {
      simulated: false,
      configured: true,
      baseUrl: 'https://api.qikink.com',
      clientId: 'client-id-abc123',
      clientSecret: 'top-secret-value-xyz',
    };
    const serialized = JSON.stringify(publicQikinkMode(health));
    assert.equal(serialized.includes('top-secret-value-xyz'), false);
    assert.equal(serialized.includes('client-id-abc123'), false);
    assert.equal(serialized.includes('api.qikink.com'), false);
    assert.match(serialized, /credentials are configured server-side/);
  });
});
