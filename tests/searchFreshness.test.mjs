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

test('manual refresh is allowed after the short attempt window, not every click', async () => {
  await withoutRedis(async () => {
    const originalNow = Date.now;
    let t = originalNow();
    Date.now = () => t;
    try {
      const q = 'manual-artist-query-2026';
      const reservation = await cache.reserveAlbumSearch(q);
      assert.equal(reservation.fetchRemote, true);
      await cache.confirmAlbumSearchSuccess(reservation, [dummyId]);

      const throttled = await cache.reserveAlbumSearch(q, { force: true });
      assert.equal(throttled.fetchRemote, false);
      assert.equal(throttled.reason, 'recent-attempt');

      t += (cache.SEARCH_ATTEMPT_SECONDS + 1) * 1000;
      assert.equal((await cache.reserveAlbumSearch(q)).fetchRemote, false); // still fresh
      assert.equal((await cache.reserveAlbumSearch(q, { force: true })).fetchRemote, true);
    } finally {
      Date.now = originalNow;
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

test('search page preserves array consumers while reporting freshness', () => {
  const api = read('../src/lib/api.js');
  const page = read('../src/app/search/page.js');
  assert.match(api, /searchAlbumsWithStatus:/);
  assert.match(api, /X-Search-Freshness/);
  assert.match(page, /Search Spotify|Check Spotify for newer albums/);
  assert.match(page, /recently-refreshed/);
  assert.match(page, /Spotify temporarily unavailable/);
});
