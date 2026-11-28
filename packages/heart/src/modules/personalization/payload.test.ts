import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  designFieldsFromOrderItem, isDemoPreview, personalizationDesignPayload,
} from './payload.ts';
import { demoTemplates, demoTemplateFor } from './templates.ts';

const demoLine = {
  sku: 'MRnHs-Bk-M',
  payload: {
    printTypeId: 1,
    designs: [{
      designCode: 'TUW-ONYX-01',
      designLink: '/images/pdp-figma/shirt/front.png',
      mockupLink: '/images/pdp-figma/shirt/back.png',
      placementSku: 'fr',
      widthInches: 12,
      heightInches: 16,
    }],
  },
};

test('camelCase design fields become Qikink snake_case with search_from_my_products: 0', () => {
  const result = personalizationDesignPayload(demoLine, { realMode: false });
  assert.deepEqual(result, {
    search_from_my_products: 0,
    print_type_id: 1,
    designs: [{
      design_code: 'TUW-ONYX-01',
      width_inches: 12,
      height_inches: 16,
      placement_sku: 'fr',
      design_link: '/images/pdp-figma/shirt/front.png',
      mockup_link: '/images/pdp-figma/shirt/back.png',
    }],
  });
  assert.equal(Object.keys(result!.designs[0]!).every((k) => !/[A-Z]/.test(k)), true);
});

test('print type is selected per line and validated against the documented ids', () => {
  const line = { ...demoLine, payload: { ...demoLine.payload, printTypeId: 23 } };
  assert.equal(personalizationDesignPayload(line, { realMode: false })!.print_type_id, 23);
  assert.equal(personalizationDesignPayload({ ...demoLine, payload: { ...demoLine.payload, printTypeId: undefined } }, { realMode: false })!.print_type_id, 1);
  assert.equal(personalizationDesignPayload({ ...demoLine, payload: { ...demoLine.payload, print_type_id: 5 } }, { realMode: false })!.print_type_id, 5);
  assert.throws(() => personalizationDesignPayload({ ...demoLine, payload: { ...demoLine.payload, printTypeId: 99 } }, { realMode: false }), /print_type_id/);
});

test('demo preview paths are accepted in demo mode and refused with keys configured', () => {
  assert.equal(isDemoPreview('/images/pdp-figma/mug/front.png'), true);
  assert.equal(isDemoPreview('//cdn.example.com/a.png'), false);
  assert.equal(isDemoPreview('images/a.png'), false);
  assert.equal(isDemoPreview('https://cdn.example.com/a.png'), false);
  assert.ok(personalizationDesignPayload(demoLine, { realMode: false }));
  assert.throws(() => personalizationDesignPayload(demoLine, { realMode: true }), /public https URL/);
  const http = { ...demoLine, payload: { ...demoLine.payload, designs: [{ ...demoLine.payload.designs[0]!, designLink: 'http://cdn.example.com/a.png' }] } };
  assert.throws(() => personalizationDesignPayload(http, { realMode: true }), /public https URL/);
  const https = { ...demoLine, payload: { ...demoLine.payload, designs: [{ ...demoLine.payload.designs[0]!, designLink: 'https://cdn.example.com/a.png', mockupLink: 'https://cdn.example.com/b.png' }] } };
  assert.ok(personalizationDesignPayload(https, { realMode: true }));
});

test('store-SKU lines never produce designs, even when a store flag is present', () => {
  assert.equal(personalizationDesignPayload({ sku: 'v-123', payload: {} }, { realMode: true }), null);
  assert.equal(personalizationDesignPayload({ sku: 'v-123', payload: { searchFromMyProducts: 1, ...demoLine.payload } }, { realMode: false }), null);
});

test('required design fields are validated', () => {
  const { designCode: _code, ...incomplete } = demoLine.payload.designs[0] as Record<string, unknown>;
  assert.throws(() => personalizationDesignPayload({ sku: 'x', payload: { designs: [incomplete] } }, { realMode: false }), /design_code/);
  const badPlacement = { ...demoLine, payload: { ...demoLine.payload, designs: [{ ...demoLine.payload.designs[0]!, placementSku: 'zz' }] } };
  assert.throws(() => personalizationDesignPayload(badPlacement, { realMode: false }), /placement_sku/);
});

test('order-item design fields use the approved preview and the demo category template', () => {
  const template = demoTemplateFor('apparel')!;
  const fields = designFieldsFromOrderItem({
    orderItemId: '0199f0c0-0000-7000-8000-000000000123',
    personalization: { monogram: 'AK', placement: 'fr' },
    previewImageUrl: '/images/pdp-figma/shirt/front.png',
    template,
  });
  assert.equal(fields.designLink, '/images/pdp-figma/shirt/front.png');
  assert.equal(fields.mockupLink, '/images/pdp-figma/shirt/front.png');
  assert.equal(fields.placementSku, 'fr');
  assert.equal(fields.widthInches, 12);
  assert.equal(fields.heightInches, 16);
  assert.equal(fields.printTypeId, 1);
  assert.match(String(fields.designCode), /^TUW-[0-9A-F]{12}$/);
  assert.ok(String(fields.designCode).length <= 20);
  assert.ok(personalizationDesignPayload({ sku: 'MRnHs-Bk-M', payload: fields }, { realMode: false }));
});

test('every demo template has documented print types, placements and local mockups', () => {
  const categories = ['apparel', 'kids-apparel', 'drinkware', 'bag', 'phone-case', 'stationery', 'home', 'pet'] as const;
  assert.deepEqual(Object.keys(demoTemplates).sort(), [...categories].sort());
  for (const template of Object.values(demoTemplates)) {
    assert.equal(template.demo, true);
    assert.ok([1, 3, 5, 23].includes(template.print_type_id));
    assert.ok(template.width_inches > 0 && template.height_inches > 0);
    assert.ok(template.mockups.length >= 2);
    for (const mockup of template.mockups) {
      assert.ok(template.placement_skus.includes(mockup.placement_sku));
      assert.ok(isDemoPreview(mockup.url), mockup.url);
    }
  }
  assert.equal(demoTemplateFor('wall-art'), null);
  assert.equal(demoTemplateFor(null), null);
});
