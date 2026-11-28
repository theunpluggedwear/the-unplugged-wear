// The storefront fallback menu, the seeded navigation_settings document and
// the admin navigation editor must agree. These guards run without a database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_ITEMS } from '../src/storefront/components/layout/navigation.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const menuData = JSON.parse(read('tuw-website/src/storefront/components/layout/navigation-menu.json'));
const migration = read('db/migrate/043-navigation-and-journal.sql');

function seededMenu(sql) {
  const marker = "'global', ";
  const start = sql.indexOf(marker);
  assert.ok(start > -1, 'migration must insert the global navigation document');
  const raw = sql.slice(start + marker.length, sql.indexOf('::jsonb', start)).trim();
  const literal = raw.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'");
  return JSON.parse(literal).menu;
}

test('fallback menu matches the canonical JSON', () => {
  assert.deepEqual(NAV_ITEMS, menuData);
  assert.deepEqual(menuData.map((item) => item.label), ['Men', 'Women', 'Kids', 'Objects', 'Shop', 'About']);
});

test('seeded navigation document matches the fallback exactly', () => {
  assert.deepEqual(seededMenu(migration), menuData);
});

test('menu fits the admin editor and every feature tile resolves in the catalog', () => {
  assert.ok(menuData.length <= 20);
  const catalog = JSON.parse(read('db/seed/catalog/curated-products.json'));
  const slugs = new Set(catalog.map((product) => product.slug));
  for (const item of menuData) {
    assert.ok((item.columns ?? []).length <= 6);
    for (const column of item.columns ?? []) assert.ok(column.links.length <= 30);
    assert.ok((item.features ?? []).length <= 2);
    for (const feature of item.features ?? []) {
      if (feature.productSlug) assert.ok(slugs.has(feature.productSlug), `unknown product ${feature.productSlug}`);
    }
  }
  assert.equal(menuData.filter((item) => item.shopAll).length, 5);
});

test('homepage featured sections and demo journal posts are seeded', () => {
  const home = read('db/migrate/033-home-cms-minimal.sql');
  assert.match(home, /'home-featured', 'home', 'featured_products'/);
  assert.match(home, /\{"mode":"latest","count":3,"productIds":\[\]\}/);
  assert.match(home, /'home-journal', 'home', 'blog_teaser'/);
  assert.equal((migration.match(/'published'/g) ?? []).length, 3);
  for (const slug of ['choosing-our-blanks', 'printing-on-demand', 'a-weekend-in-linen']) {
    assert.ok(migration.includes(slug), `missing demo post ${slug}`);
  }
});
