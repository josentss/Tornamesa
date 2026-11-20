import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const api = read('../src/app/api/profiles/username/[username]/yearly-top/route.js');
const sql = read('../supabase/migrations/20261118_01_yearly_top_stats.sql');
const page = read('../src/app/[username]/yearly-top/page.js');
const clientApi = read('../src/lib/api.js');
const monthlyPage = read('../src/app/[username]/monthly-top/page.js');
const profileWidget = read('../src/components/profile/MonthlyTopWidget.jsx');

test('annual API authorizes before rate limiting and before any RPC', () => {
  const policy = api.indexOf("canViewWithFollows(supabase, viewer, profile, 'top')");
  const limit = api.indexOf('await rateLimit(');
  const rpc = api.indexOf("supabase.rpc('top_albums'");
  assert.ok(policy >= 0 && limit > policy && rpc > limit);
  assert.match(api, /getRequestUser\(request\)/);
  assert.match(api, /buildYearTopRanges\(year, tz\)/);
  assert.match(api, /private, no-store/);
  assert.match(api, /clientKey\(request, 'yearly-top', viewer\?\.id\)/);
  assert.match(api, /return json\(\{ error: 'This top is private' \}, 403\)/);
  assert.match(api, /return json\(\{ error: 'Invalid year' \}, 400\)/);
  const validation = api.indexOf('Number(requestedYear) > 2100');
  const login = api.indexOf('await getRequestUser(request)');
  assert.ok(validation !== -1 && validation < login,
    'The entire year range must be validated before authentication and profile access');
});

test('annual API is read-only, has bounded responses and never falls back to listen ratings', () => {
  assert.match(api, /p_limit: 50/);
  assert.match(api, /p_min_rating: 1, p_limit: 5/);
  assert.match(api, /supabase\.rpc\('yearly_top_stats'/);
  assert.match(api, /supabase\.rpc\('list_listen_months'/);
  assert.match(api, /rating: row\.rating == null \? null : Number\(row\.rating\)/);
  assert.doesNotMatch(api, /\.from\('listens'\)|\.from\('monthly_top_entries'\)/);
  assert.doesNotMatch(api, /err\.message|error\.message/);
});

test('yearly summary database function reads complete data with canonical review ratings', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.yearly_top_stats/);
  assert.match(sql, /SECURITY DEFINER SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.yearly_top_stats/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /FROM public\.listens AS l/);
  assert.match(sql, /JOIN public\.reviews AS rv/);
  assert.match(sql, /monthly_top_timezone\(p_user_id\)/);
  assert.match(sql, /generate_series\(1,12\)/);
  assert.match(sql, /NOT EXISTS \(/);
  assert.match(sql, /'topArtists'/);
  assert.doesNotMatch(sql, /\bINSERT INTO public\.listens\b|\bDELETE FROM public\.listens\b/);
  assert.doesNotMatch(sql, /\bUPDATE public\.monthly_summaries\b/);
});

test('yearly page uses Tornamesa palette, responsive layout, and accessible navigation', () => {
  assert.match(page, /bg-\[#0a0f16\]/);
  assert.match(page, /text-\[#7cc7e8\]/);
  assert.match(page, /grid-cols-2/);
  assert.match(page, /aria-label="Top periods"/);
  assert.match(page, /aria-label="Monthly listening activity"/);
  assert.match(page, /Highest rated/);
  assert.match(page, /First-time albums/);
  assert.match(page, /Share link/);
  assert.match(page, /Suspense/);
  assert.match(clientApi, /getYearlyTop: async/);
  assert.match(monthlyPage, /yearly-top\?year=/);
  assert.match(profileWidget, /yearly-top/);
});

test('monthly activity shows distinct readable month labels and accessible totals', () => {
  assert.match(page, /const MONTH_NAMES = \[/);
  assert.match(page, /aria-label="Monthly listening totals"/);
  assert.match(page, /aria-hidden="true"/);
  assert.match(page, /MONTH_NAMES\[m\.month - 1\]/);
  assert.match(page, /text-\[9px\].*sm:text-\[10px\]/);
  assert.doesNotMatch(page, /MONTHS\[m\.month - 1\]\[0\]/);
});

test('annual ranking communicates the 50-album cap and keyboard controls', () => {
  assert.match(page, /Top \{albums\.length\} of \{fmt\(s\?\.uniqueAlbums\)\} albums/);
  assert.match(page, /id="yearly-album-list"/);
  assert.match(page, /aria-controls="yearly-album-list" aria-expanded=\{allAlbums\}/);
  assert.match(page, /"Show top " \+ albums\.length \+ " albums"/);
  assert.match(page, /focus-visible:outline/);
  assert.match(page, /focus-visible:ring-2/);
});
