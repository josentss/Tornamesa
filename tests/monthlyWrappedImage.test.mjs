import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const image = read('../src/lib/monthlyWrappedImage.js');
const page = read('../src/app/[username]/monthly-top/page.js');

test('monthly image is a 9:16 story using the yearly color themes', () => {
  assert.match(image, /const W = 1080;/);
  assert.match(image, /const H = 1920;/);
  assert.match(page, /theme: YEARLY_THEMES\[themeId \|\| wrappedTheme\]/);
  assert.match(page, /generateMonthlyWrappedPng/);
});

test('the browser fonts used by the monthly image are public files', () => {
  for (const subset of ['latin', 'latin-ext']) {
    for (const weight of [400, 600, 800]) {
      assert.ok(existsSync(new URL(`../public/fonts/inter-${subset}-${weight}-normal.woff`, import.meta.url)));
    }
  }
});
