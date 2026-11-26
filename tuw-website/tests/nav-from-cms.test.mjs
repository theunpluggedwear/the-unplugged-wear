import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navItemsFromCms, shopFilterFrom } from '../src/storefront/lib/nav-from-cms.ts';

test('shopFilterFrom keeps only known shop filter keys', () => {
  assert.deepEqual(shopFilterFrom({ audience: 'men', category: 'hoodies', q: ['AOP'], isNew: true, junk: 1 }), {
    audience: 'men', category: 'hoodies', q: ['AOP'], isNew: true,
  });
  assert.equal(shopFilterFrom({ audience: 'unknown' }), undefined);
  assert.equal(shopFilterFrom({ q: [1, ''] }), undefined);
  assert.equal(shopFilterFrom('bad'), undefined);
});

test('navItemsFromCms maps the shared menu into storefront nav items', () => {
  const items = navItemsFromCms([{
    label: 'Men', href: '/shop?audience=men',
    columns: [{
      title: 'Clothing',
      links: [
        { label: 'Hoodies', href: '/shop/hoodies', filter: { audience: 'men', category: 'hoodies' } },
        { label: 'Size guide', href: '/size-guide' },
      ],
    }],
    features: [{ productSlug: 'hoodie', title: 'Pullover', imagePosition: '50% 0%' }],
    shopAll: { label: 'Shop all men', href: '/shop?audience=men', filter: { audience: 'men' } },
  }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].columns[0].links.length, 2);
  assert.deepEqual(items[0].columns[0].links[0].filter, { audience: 'men', category: 'hoodies' });
  assert.equal(items[0].columns[0].links[1].filter, undefined);
  assert.deepEqual(items[0].features[0], { productSlug: 'hoodie', title: 'Pullover', imagePosition: '50% 0%' });
  assert.deepEqual(items[0].shopAll.filter, { audience: 'men' });
});

test('navItemsFromCms keeps empty collections absent and tolerates an empty menu', () => {
  assert.deepEqual(navItemsFromCms([]), []);
  const item = navItemsFromCms([{ label: 'About', href: '/about', columns: [] }])[0];
  assert.equal(item.columns, undefined);
  assert.equal(item.features, undefined);
});
