import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const doc = readFileSync(join(root, 'DOC/backend/23-Backend-Implementation.md'), 'utf8');
const roots = [
  join(root, 'packages/heart/src'),
  join(root, 'tuw-admin/src'),
  join(root, 'tuw-website/src'),
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

test('every environment variable read in code is documented in the matrix', () => {
  const used = new Set();
  for (const dir of roots) {
    for (const file of walk(dir)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        used.add(match[1]);
      }
    }
  }
  const missing = [...used].filter((name) => !doc.includes(`\`${name}\``));
  assert.deepEqual(missing, [], `undocumented env vars: ${missing.join(', ')}`);
  assert.ok(doc.includes('## 9. Environment matrix'));
});
