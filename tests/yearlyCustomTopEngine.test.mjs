import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const timezoneSource = read('../src/lib/timezone.js');
const rangeSource = read('../src/lib/topRanges.js')
  .replace("import { normalizeTimeZone, zonedMonthRange } from '@/lib/timezone';", timezoneSource);
const ranges = await import('data:text/javascript,' + encodeURIComponent(rangeSource));
const ranking = await import('data:text/javascript,' +
  encodeURIComponent(read('../src/lib/topRanking.js')));

test('annual range has exactly 12 unique, chronological local months', () => {
  const periods = ranges.buildYearTopRanges(2026, 'America/Bogota');
  assert.equal(periods.length, 12);
  assert.equal(periods[0].month, '2026-01');
  assert.equal(periods[0].start, '2026-01-01T05:00:00.000Z');
  assert.equal(periods.at(-1).month, '2026-12');
  assert.equal(periods.at(-1).end, '2027-01-01T05:00:00.000Z');
  for (let i = 1; i < periods.length; i++) {
    assert.equal(periods[i - 1].end, periods[i].start);
  }
});

test('custom ranges allow nonconsecutive months in different years', () => {
  const periods = ranges.buildTopMonthRanges([
    '2026-11', { year: 2025, month: 12 }, '2026-01',
  ], 'UTC');
  assert.deepEqual(periods.map((p) => p.month), ['2025-12', '2026-01', '2026-11']);
  assert.deepEqual(ranges.toTopRpcRanges(periods), periods.map(({ start, end }) => ({ start, end })));
});

test('daylight-saving transitions and positive UTC offsets use owner timezone', () => {
  const [ny] = ranges.buildTopMonthRanges(['2026-03'], 'America/New_York');
  assert.deepEqual(
    [ny.start, ny.end],
    ['2026-03-01T05:00:00.000Z', '2026-04-01T04:00:00.000Z']
  );
  const [kir] = ranges.buildTopMonthRanges(['2026-01'], 'Pacific/Kiritimati');
  assert.equal(kir.start, '2025-12-31T10:00:00.000Z');
  assert.equal(kir.end, '2026-01-31T10:00:00.000Z');
});

test('reject duplicate, invalid and oversized month selections', () => {
  assert.throws(() => ranges.buildTopMonthRanges(['2026-01', '2026-01']), /Duplicate/);
  assert.throws(() => ranges.buildTopMonthRanges(['2026-13']), /Invalid/);
  assert.throws(() => ranges.buildTopMonthRanges([]), /Select between/);
  assert.throws(() => ranges.buildTopMonthRanges(
    Array.from({length: 25}, (_, i) => ({year: 2024 + Math.floor(i / 12), month: i % 12 + 1}))
  ), /Select between/);
  assert.throws(() => ranges.buildYearTopRanges(2026.5), /Invalid/);
  assert.throws(() => ranges.toTopRpcRanges([]), /Invalid/);
});

test('top sort: number of listens, then earliest listen and ID', () => {
  const rows = [
    { albumId: 'b', listenCount: 2, rating: 9, firstListenedAt: '2026-01-02T00:00:00Z' },
    { albumId: 'a', listenCount: 2, rating: null, firstListenedAt: '2026-01-01T00:00:00Z' },
    { albumId: 'z', listenCount: 4, rating: 1, firstListenedAt: '2026-01-04T00:00:00Z' },
  ];
  assert.deepEqual(rows.sort((a, b) => ranking.compareTopAlbums(a, b))
    .map((row) => row.albumId), ['z', 'a', 'b']);
});

test('rating sort uses the general album score; unreviewed albums go last', () => {
  const data = [
    { albumId: 'a', listenCount: 12, rating: null, firstListenedAt: '2026-01-01T00:00:00Z' },
    { albumId: 'b', listenCount: 2, rating: 8, firstListenedAt: '2026-01-04T00:00:00Z' },
    { albumId: 'c', listenCount: 1, rating: 10, firstListenedAt: '2026-01-05T00:00:00Z' },
  ];
  assert.deepEqual(data.sort((a, b) => ranking.compareTopAlbums(a, b, 'rating'))
    .map((row) => row.albumId), ['c', 'b', 'a']);
  assert.throws(() => ranking.compareTopAlbums(data[0], data[1], 'whatever'), /Invalid/);
});

test('repeats excludes one-time listens, preserving deterministic order', () => {
  assert.equal(ranking.eligibleForTopSort({ listenCount: 1 }, 'repeats'), false);
  assert.equal(ranking.eligibleForTopSort({ listenCount: 2 }, 'repeats'), true);
  const rows = [
    { albumId: 'a', listenCount: 2, firstListenedAt: '2026-01-04T00:00:00Z' },
    { albumId: 'b', listenCount: 4, firstListenedAt: '2026-01-06T00:00:00Z' },
  ];
  assert.equal(rows.sort((a, b) => ranking.compareTopAlbums(a, b, 'repeats'))[0].albumId, 'b');
});

const sql = read('../supabase/migrations/20261117_03_top_albums_ranges.sql');

test('SQL is a read-only, service-role-only query and avoids a PostgREST listen row cap', () => {
  assert.match(sql, /SECURITY DEFINER SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.top_albums/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /WITH bounds AS MATERIALIZED/);
  assert.match(sql, /FROM public\.listens AS l/);
  assert.match(sql, /EXISTS \(\s*SELECT 1 FROM bounds/);
  assert.doesNotMatch(sql, /\bINSERT INTO public\.listens\b|\bDELETE FROM public\.listens\b/);
  assert.doesNotMatch(sql, /\bUPDATE public\.monthly_summaries\b/);
});

test('SQL uses canonical reviews.rating and safe filters, not historic listen ratings', () => {
  assert.match(sql, /LEFT JOIN public\.reviews AS rv/);
  assert.match(sql, /rv\.rating::numeric/);
  assert.doesNotMatch(sql, /listen_avg|avg\(l\.rating|l\.rating/);
  assert.match(sql, /p_sort <> 'repeats' OR a\.listen_count > 1/);
  assert.match(sql, /lower\(album\.artist\) = lower\(btrim\(p_artist\)\)/);
  assert.match(sql, /e\.album_id ASC/);
  assert.match(sql, /p_limit NOT BETWEEN 1 AND 100/);
  assert.match(sql, /Overlapping months are not allowed/);
});

test('database migration is deliberately separate from UI rollout', () => {
  const monthlyTop = read('../src/lib/monthlyTop.js');
  assert.match(monthlyTop, /rebuild_monthly_top_atomic/);
  assert.doesNotMatch(monthlyTop, /top_albums/); // monthly endpoints unchanged
  assert.match(sql, /DROP FUNCTION public\.top_albums/); // commented rollback
});
