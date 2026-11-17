import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/diaryRating.js', import.meta.url), 'utf8');
const { resolveDiaryRating, enrichDiaryRatings } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
);

const listens = [
  { id: 1, album_id: 'a', rating: 8, listened_at: '2026-11-17T12:00:00Z' },
  { id: 2, album_id: 'a', rating: null, listened_at: '2026-11-16T12:00:00Z' },
  { id: 3, album_id: 'b', rating: 6, listened_at: '2026-11-15T12:00:00Z' },
  { id: 4, album_id: 'c', rating: null, listened_at: '2026-11-14T12:00:00Z' },
];
const albumReviews = [
  { album_id: 'a', rating: 10 },
  { album_id: 'b', rating: 7 },
];

test('edited listen rating takes precedence over album review in diary', () => {
  assert.equal(resolveDiaryRating(8, 10), 8);
  assert.equal(resolveDiaryRating(9, 10), 9);
  assert.equal(resolveDiaryRating(null, 10), 10);
  assert.equal(resolveDiaryRating(null, null), null);
});

test('raw listen and album rating remain separately available after reload', () => {
  const enriched = enrichDiaryRatings(listens, albumReviews);
  assert.equal(enriched[0].rating, 8);
  assert.equal(enriched[0].listenRating, 8);
  assert.equal(enriched[0].albumRating, 10);
  assert.equal(enriched[1].rating, 10);
  assert.equal(enriched[1].listenRating, null);
  assert.equal(enriched[1].albumRating, 10);
  assert.equal(enriched[2].rating, 6);
  assert.equal(enriched[3].rating, null);
  assert.equal(listens[0].rating, 8); // helper is immutable
});

test('after PATCH a new listen rating remains visible despite older album review', () => {
  const updated = listens.map((item) =>
    item.id === 1 ? { ...item, rating: 5 } : item
  );
  const enriched = enrichDiaryRatings(updated, albumReviews);
  assert.equal(enriched[0].rating, 5);
  assert.equal(enriched[0].listenRating, 5);
  assert.equal(enriched[0].albumRating, 10); // review remains independent
});

test('album review is a fallback, never copied into raw listen rating', () => {
  const rows = enrichDiaryRatings(listens, albumReviews);
  assert.equal(rows[1].listenRating, null);
  assert.equal(rows[1].rating, 10);
  assert.equal(rows[3].listenRating, null);
  assert.equal(rows[3].albumRating, null);
});

test('raw rating update does not mutate neighboring listens on the same album', () => {
  const updated = listens.map((x) => x.id === 1 ? { ...x, rating: 4 } : x);
  const rows = enrichDiaryRatings(updated, albumReviews);
  assert.equal(rows[0].rating, 4);
  assert.equal(rows[1].rating, 10);
  assert.equal(rows[1].listenRating, null);
});
