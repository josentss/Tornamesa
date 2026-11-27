import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const route = readFileSync(new URL('../src/app/api/og/yearly/route.js', import.meta.url), 'utf8');
const cards = readFileSync(new URL('../src/components/yearly/YearlyWrappedCards.jsx', import.meta.url), 'utf8');

test('all five yearly cards use explicit Satori layout and a common safe-area frame', () => {
  const openingTags = [...cards.matchAll(/<div\b(?:(?!>).)*>/gs)];
  assert.ok(openingTags.length >= 25);
  assert.deepEqual(openingTags.filter(([tag]) => !/\bdisplay:\s*'(?:flex|none)'/.test(tag)).map(([tag]) => tag), []);
  assert.match(cards, /height: l\.body, flexShrink: 0/);
  assert.doesNotMatch(cards, /position: 'absolute'/);
  assert.match(route, /<YearlyWrappedCard card=\{card\}/);
});
test('yearly PNG resolves before HTTP response, so Satori exceptions enter error handler', () => {
  assert.match(route, /const image = new ImageResponse\(/);
  assert.match(route, /const png = await image\.arrayBuffer\(\)/);
  assert.match(route, /return new Response\(png, \{/);
  assert.match(route, /'Content-Type': 'image\/png'/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(route, /return new ImageResponse\(/);
});
