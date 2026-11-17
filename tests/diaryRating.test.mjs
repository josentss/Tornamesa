import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/diaryRating.js', import.meta.url), 'utf8');
const { resolveDiaryRating, enrichDiaryRatings } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
);

const listens = [
  { id: 1, album_id: 'a', rating: 8, review: 'Old private note', listened_at: '2026-11-17T12:00:00Z' },
  { id: 2, album_id: 'a', rating: 3, review: null, listened_at: '2026-10-16T12:00:00Z' },
  { id: 3, album_id: 'b', rating: 6, listened_at: '2026-11-15T12:00:00Z' },
  { id: 4, album_id: 'c', rating: null, listened_at: '2026-11-14T12:00:00Z' },
];
const reviews = [
  { album_id: 'a', rating: 10, review_text: 'General album review' },
  { album_id: 'b', rating: 7, review_text: null },
];

test('every listen date shows the single canonical album rating and review', () => {
  const rows = enrichDiaryRatings(listens, reviews);
  assert.equal(resolveDiaryRating(10), 10);
  assert.equal(rows[0].rating, 10);
  assert.equal(rows[1].rating, 10);
  assert.equal(rows[0].albumRating, 10);
  assert.equal(rows[0].review, 'General album review');
  assert.equal(rows[1].review, 'General album review');
  assert.equal(rows[2].rating, 7);
  assert.equal(rows[3].rating, null);
});

test('changing general album review reflects across all months and listens', () => {
  const changed = reviews.map((r) =>
    r.album_id === 'a'
      ? { ...r, rating: 5, review_text: 'Changed from the diary' }
      : r
  );
  const rows = enrichDiaryRatings(listens, changed);
  assert.deepEqual(rows.filter((r) => r.album_id === 'a').map((r) => r.rating), [5, 5]);
  assert.deepEqual(
    rows.filter((r) => r.album_id === 'a').map((r) => r.review),
    ['Changed from the diary', 'Changed from the diary']
  );
});

test('unreviewed albums do not resurrect old per-listen ratings', () => {
  const rows = enrichDiaryRatings(listens, []);
  assert.equal(rows[0].rating, null);
  assert.equal(rows[1].rating, null);
  assert.equal(rows[2].rating, null);
  assert.equal(rows[0].albumRating, null);
});

test('raw history is archived for owner, but not leaked in public diary', () => {
  const owner = enrichDiaryRatings(listens, reviews, { includeLegacy: true });
  assert.equal(owner[0].listenRating, 8);
  assert.equal(owner[0].legacyNote, 'Old private note');
  assert.equal(owner[0].rating, 10);
  const visitor = enrichDiaryRatings(listens, reviews);
  assert.equal(visitor[0].listenRating, undefined);
  assert.equal(visitor[0].legacyNote, undefined);
  assert.equal(visitor[0].review, 'General album review');
});

test('removing a review removes the album rating without exposing old ratings', () => {
  const rows = enrichDiaryRatings(listens, reviews.filter((r) => r.album_id !== 'a'));
  assert.equal(rows[0].rating, null);
  assert.equal(rows[1].rating, null);
  assert.equal(rows[2].rating, 7);
});

test('the original listens and reviews arrays stay unchanged', () => {
  enrichDiaryRatings(listens, reviews);
  assert.equal(listens[0].rating, 8);
  assert.equal(listens[0].review, 'Old private note');
  assert.equal(reviews[0].rating, 10);
});
