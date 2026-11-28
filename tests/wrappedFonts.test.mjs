import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('yearly PNG ships real font weights so the hierarchy survives rendering', () => {
  assert.match(read('../src/app/api/og/yearly/route.js'), /fonts: await loadWrappedFonts\(\)/);
  for (const subset of ['latin', 'latin-ext']) {
    for (const weight of [400, 600, 800]) {
      const url = new URL(`../src/assets/fonts/inter-${subset}-${weight}-normal.woff`, import.meta.url);
      assert.ok(existsSync(url), `${subset} ${weight} font is committed`);
    }
  }
});
