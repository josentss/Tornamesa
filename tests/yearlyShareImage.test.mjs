import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../src/app/api/og/yearly/route.js');
const yearlyApi = read('../src/app/api/profiles/username/[username]/yearly-top/route.js');
const page = read('../src/app/[username]/yearly-top/page.js');
const client = read('../src/lib/api.js');
const monthlyWrapped = read('../src/app/api/og/wrapped/route.js');

test('annual PNG never queries stats before profile authorization and rate limit', () => {
  const yearGuard = route.indexOf("if (requestedYear !== null &&");
  const viewer = route.indexOf('await getRequestUser(request)');
  const allow = route.indexOf("canViewWithFollows(supabase, viewer, profile, 'top')");
  const throttle = route.indexOf('await rateLimit(');
  const rank = route.indexOf("supabase.rpc('top_albums'");
  const stats = route.indexOf("supabase.rpc('yearly_top_stats'");
  assert.ok(yearGuard !== -1 && viewer > yearGuard);
  assert.ok(allow > viewer && throttle > allow && rank > throttle && stats > throttle);
  assert.match(route, /return errorResponse\('This top is private', 403\)/);
  assert.match(route, /return errorResponse\('Invalid year', 400\)/);
  assert.match(route, /clientKey\(request, 'yearly-image', viewer\?\.id\)/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(route, /limited\.headers\.set\('Cache-Control', 'private, no-store'\)/);
  assert.doesNotMatch(route, /\.from\('listens'\)|\.from\('monthly_top_entries'\)/);
});

test('annual image ranks using exactly the same stable SQL engine as Yearly Top', () => {
  for (const code of [route, yearlyApi]) {
    assert.match(code, /supabase\.rpc\('top_albums'/);
    assert.match(code, /supabase\.rpc\('yearly_top_stats'/);
    assert.match(code, /p_sort: 'listens'/);
    assert.match(code, /p_min_listens: 1/);
    assert.match(code, /p_artist: null/);
    assert.match(code, /p_min_rating: null/);
    assert.match(code, /buildYearTopRanges\(year, tz\)/);
    assert.match(code, /p_user_id: profile\.id/);
  }
  assert.match(route, /p_limit: 5/);
  assert.match(yearlyApi, /p_limit: 50/);
  assert.match(route, /MONTHS\[Number\(peak\.month\) - 1\]/);
});

test('image uses a fixed 1080 x 1350 PNG without inventing history', () => {
  assert.match(route, /new ImageResponse\(/);
  assert.match(route, /width: 1080, height: 1350, headers: NO_STORE/);
  assert.match(route, /fmt\(summary\.totalListens\)/);
  assert.match(route, /fmt\(summary\.uniqueAlbums\)/);
  assert.match(route, /fmt\(summary\.uniqueArtists\)/);
  assert.match(route, /summary\.topArtists\[0\]/);
  assert.match(route, /No albums logged this year/);
  assert.doesNotMatch(route, /minutes played|listening streak|estimated minutes/i);
});

test('cover downloads are optional, whitelisted, and strictly bounded', () => {
  assert.match(route, /parsed\.protocol === 'https:'/);
  assert.match(route, /i\.scdn\.co/);
  assert.match(route, /res\.cloudinary\.com/);
  assert.match(route, /redirect: 'error'/);
  assert.match(route, /AbortSignal\.timeout\(3000\)/);
  assert.match(route, /bytes\.byteLength > 2_000_000/);
  assert.match(route, /return null;/);
  assert.doesNotMatch(route, /fetch\(album\?\.cover_url\)/);
});

test('annual image actions coexist with the existing share link', () => {
  assert.match(page, /Share link/);
  assert.match(page, /Share image/);
  assert.match(page, /Download PNG/);
  assert.match(page, /aria-label="Yearly image actions"/);
  assert.match(page, /disabled=\{imageBusy\}/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /api\.getYearlyTopImage\(data\.username, \{ year: data\.year \}\)/);
  assert.match(page, /navigator\.canShare\?\.\(\{ files: \[file\] \}\)/);
  assert.match(page, /anchor\.download = name/);
  assert.match(page, /shareError\?\.name === "AbortError"/);
  assert.match(page, /Native file sharing is not available/);
  assert.match(page, /URL\.revokeObjectURL\(objectUrl\)/);
});

test('image client forwards verified optional bearer and validates content-type', () => {
  assert.match(client, /getYearlyTopImage: async/);
  assert.match(client, /\/api\/og\/yearly\?/);
  assert.match(client, /headers: await authHeadersOptional\(\)/);
  assert.match(client, /blob\.type !== 'image\/png'/);
  assert.match(client, /response\.status === 403/);
  assert.match(client, /response\.status === 429/);
});

test('monthly Wrapped is retained unchanged as a separate route', () => {
  assert.match(monthlyWrapped, /Monthly Wrapped/);
  assert.match(monthlyWrapped, /rebuild|ensureMonthlyTop/);
  assert.match(route, /YEARLY TOP/);
});
