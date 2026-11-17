import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/lib/searchFreshness.js');
const script = source.replace("import { Redis } from '@upstash/redis';", "const Redis = {};");
const cache = await import('data:text/javascript,' + encodeURIComponent(script));

function withoutRedis(fn) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  return Promise.resolve().then(fn).finally(() => {
    if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url;
    if (token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = token;
  });
}

const dummyId = '26HtS2Tm1IjNwGyiLAlnwc';

test('query hashing is shared across case and whitespace variations', () => {
  assert.equal(cache.searchQueryKey('  RADIOHEAD '), cache.searchQueryKey('radiohead'));
  assert.equal(cache.searchQueryKey('Radiohead  album'), cache.searchQueryKey('radiohead album'));
  assert.notEqual(cache.searchQueryKey('radiohead'), cache.searchQueryKey('boris'));
});

test('first-ever query searches Spotify regardless of local catalog count', async () => {
  await withoutRedis(async () => {
    const reservation = await cache.reserveAlbumSearch('never-searched-artist-2026');
    assert.equal(reservation.fetchRemote, true);
    await cache.confirmAlbumSearchSuccess(reservation, [dummyId]);
    const repeat = await cache.reserveAlbumSearch(' NEVER-SEARCHED-ARTIST-2026 ');
    assert.deepEqual(
      { fetchRemote: repeat.fetchRemote, reason: repeat.reason },
      { fetchRemote: false, reason: 'recently-refreshed' }
    );
    assert.deepEqual(await cache.getRecentAlbumSearchIds('never-searched-artist-2026'), [dummyId]);
  });
});

test('repeated searches do not bypass freshness or cause extra Spotify requests', async () => {
  await withoutRedis(async () => {
    const q = 'automatically-protected-artist-2026';
    const first = await cache.reserveAlbumSearch(q);
    assert.equal(first.fetchRemote, true);
    await cache.confirmAlbumSearchSuccess(first, [dummyId]);
    for (let i = 0; i < 4; i++) {
      const repeat = await cache.reserveAlbumSearch(q);
      assert.equal(repeat.fetchRemote, false);
      assert.equal(repeat.reason, 'recently-refreshed');
    }
  });
});

test('freshness expires, enabling automatic retrieval of newer releases', async () => {
  await withoutRedis(async () => {
    const originalNow = Date.now;
    let t = originalNow();
    Date.now = () => t;
    try {
      const q = 'new-release-artist-query-2026';
      const first = await cache.reserveAlbumSearch(q);
      await cache.confirmAlbumSearchSuccess(first, [dummyId]);
      t += (cache.SEARCH_FRESH_SECONDS + 1) * 1000;
      const second = await cache.reserveAlbumSearch(q);
      assert.equal(second.fetchRemote, true);
    } finally {
      Date.now = originalNow;
    }
  });
});

test('inflight / failed requests do not stamp the query as Spotify-fresh', async () => {
  await withoutRedis(async () => {
    const q = 'spotify-outage-query-2026';
    assert.equal((await cache.reserveAlbumSearch(q)).fetchRemote, true);
    // No confirmAlbumSearchSuccess on 429/network failure.
    const attempt = await cache.reserveAlbumSearch(q);
    assert.equal(attempt.fetchRemote, false);
    assert.equal(attempt.reason, 'recent-attempt');
  });
});

test('search API no longer uses arbitrary local hit counts to suppress freshness', () => {
  const route = read('../src/app/api/search/route.js');
  const album = read('../src/lib/albumResolve.js');
  assert.doesNotMatch(route, /local\.length\s*<\s*8/);
  assert.match(route, /reserveAlbumSearch\(trimmed/);
  assert.match(route, /confirmAlbumSearchSuccess\(decision, remote\.map/);
  assert.match(route, /getRecentAlbumSearchIds\(trimmed\)/);
  assert.match(route, /getLocalAlbumsByIds/);
  assert.match(route, /strictPersistence: true/);
  assert.match(album, /if \(strictPersistence\) throw e/);
});

test('search UI has no manual Spotify button or technical status', () => {
  const api = read('../src/lib/api.js');
  const page = read('../src/app/search/page.js');
  const route = read('../src/app/api/search/route.js');
  assert.match(api, /searchAlbums: \(query, type = 'album'\)/);
  assert.doesNotMatch(api, /searchAlbumsWithStatus|forceSpotify/);
  assert.match(page, /api\.searchAlbums\(trimmed, "album"\)/);
  assert.doesNotMatch(page, /Check Spotify for newer albums|Catalog checked with Spotify/);
  assert.doesNotMatch(page, /Showing recently refreshed|recently-refreshed|remoteSearched|freshness/);
  assert.match(route, /reserveAlbumSearch\(trimmed\)/);
  assert.doesNotMatch(route, /searchParams\.get\('remote'\)/);
  assert.match(route, /X-Search-Freshness/); // monitoring header only
});
