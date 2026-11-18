import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const quotaSource = read('../src/lib/spotifyQuota.js');
const moduleSource = quotaSource
  .replace("import { Redis } from '@upstash/redis';", 'const Redis = {};')
  .replace("import { rateLimit } from '@/lib/rateLimit';",
    'const rateLimit = async () => ({ ok: true });');
const quota = await import('data:text/javascript,' + encodeURIComponent(moduleSource));

test('quota and ordinary rolling limits are distinguished', () => {
  assert.equal(quota.isQuotaExceeded({ error: { reason: 'QUOTA_EXCEEDED' } }), true);
  assert.equal(quota.isQuotaExceeded({ error: { status: 429 } }), false);
  assert.equal(quota.retryAfterSeconds('75'), 75);
  assert.equal(quota.retryAfterSeconds('invalid'), null);
});

test('remote import search fails closed without shared Redis', async () => {
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const result = await quota.reserveSpotifyImportSearch('u', 'hash');
    assert.deepEqual(result, { allowed: false, unavailable: true });
  } finally {
    if (oldUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});

const preview = read('../src/app/api/import/notes/preview/route.js');
const commit = read('../src/app/api/import/notes/commit/route.js');
const migration = read('../supabase/migrations/20261117_02_safe_import_note_rows.sql');
const ui = read('../src/components/monthly-top/ImportLogsModal.jsx');
const album = read('../src/app/api/albums/[id]/route.js');
const albumResolver = read('../src/lib/albumResolve.js');
const spotify = read('../src/lib/spotify.js');

test('preview is local-only unless user explicitly opts into remote mode', () => {
  assert.match(preview, /body\.spotifyMode === 'limited'/);
  assert.match(preview, /spotifySharedQuotaConfigured\(\)/);
  assert.match(preview, /MAX_REMOTE_SEARCHES_PER_CHUNK = 2/);
  assert.match(preview, /reserveSpotifyImportSearch\(/);
  assert.match(preview, /searchSpotifyAlbums\(q, 10\)/);
  assert.doesNotMatch(preview, /for \(const q of queries\)/);
});

test('import commit never invokes Spotify; source file is checked against selected lines', () => {
  assert.doesNotMatch(commit, /spotifyFetch|searchSpotifyAlbums|ensureAlbum\(/);
  assert.match(commit, /parseNotesFile\(file\.content, file\.name\)/);
  assert.match(commit, /count !== sourceRow\.count/);
  assert.match(commit, /lineIndices\.has\(lineIndex\)/);
  assert.match(commit, /commit_note_import_atomic/);
  assert.match(commit, /file\.content/);
});

test('SQL import uses row ledger, one transaction and privileged RPC', () => {
  assert.match(migration, /PRIMARY KEY \(user_id, file_sha256, line_index\)/);
  assert.match(migration, /ON CONFLICT \(user_id, file_sha256, line_index\) DO NOTHING/);
  assert.match(migration, /INSERT INTO public\.listens/);
  assert.match(migration, /RETURNS jsonb/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /TO service_role/);
  assert.doesNotMatch(migration, /DELETE FROM public\.listens/);
});

test('ambiguous albums require an explicit selection', () => {
  assert.match(ui, /const chosen = selectedAmbiguous\[key\]/);
  assert.match(ui, /<option value="">Select the correct album/);
  assert.doesNotMatch(ui, /selectedAmbiguous\[key\] \|\| r\.albumId/);
  assert.match(ui, /api\.commitNotesImport\(\s*payload,\s*sourceFile,/);
});

test('search metadata writes are awaited and do not replace existing durations', () => {
  assert.match(albumResolver, /ignoreDuplicates: true/);
  assert.match(albumResolver, /await upsertAlbumsMapped/);
  assert.doesNotMatch(albumResolver, /void Promise\.allSettled/);
  assert.match(albumResolver, /Math\.min\(10, clampSearchLimit/);
});

test('album details are lazy, temporarily cached and have honest fallback', () => {
  assert.match(album, /readCachedAlbumDetails/);
  assert.match(album, /storeCachedAlbumDetails/);
  assert.match(album, /metadataStatus: 'basic'/);
  assert.match(album, /metadataStatus: complete \? 'complete' : 'partial'/);
  assert.match(album, /page < 2/);
  assert.doesNotMatch(album, /\/v1\/artists\//);
});

test('Spotify wrapper does not retry 429 responses automatically', () => {
  assert.match(spotify, /reserveSpotifyRequest/);
  assert.match(spotify, /recordSpotify429\(response\)/);
  assert.doesNotMatch(spotify, /while \(response\.status === 429/);
});

test('offline source file hashing is the same in preview and commit', () => {
  assert.match(preview, /createHash\('sha256'\)/);
  assert.match(commit, /createHash\('sha256'\)/);
  assert.match(preview, /update\(name\)\.update\('\\0'\)\.update\(content\)/);
  assert.match(commit, /update\(file\.name\)\.update\('\\0'\)\.update\(file\.content\)/);
});
