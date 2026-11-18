import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/app/api/profiles/username/[username]/yearly-top/route.js', import.meta.url),
  'utf8'
);

const stubs = new Map([
  [
    "import { NextResponse } from 'next/server';",
    "const NextResponse = { json: (body, opts = {}) => new Response(JSON.stringify(body), { status: opts.status ?? 200, headers: opts.headers }) };",
  ],
  [
    "import { createSupabaseServer } from '@/lib/supabase-server';",
    "const createSupabaseServer = () => { throw Error('Invalid year attempted a database query'); };",
  ],
  [
    "import { getRequestUser } from '@/lib/apiAuth';",
    "const getRequestUser = async () => { throw Error('Invalid year attempted authentication'); };",
  ],
  [
    "import { canViewWithFollows } from '@/lib/visibilityAccess';",
    "const canViewWithFollows = async () => { throw Error('Unexpected permission lookup'); };",
  ],
  [
    "import { localDateKey, normalizeTimeZone } from '@/lib/timezone';",
    "const localDateKey = () => '2026-11-18'; const normalizeTimeZone = (v) => v;",
  ],
  [
    "import { buildYearTopRanges, toTopRpcRanges } from '@/lib/topRanges';",
    "const buildYearTopRanges = () => { throw Error('Unexpected range processing'); }; const toTopRpcRanges = (v) => v;",
  ],
  [
    "import { clientKey, rateLimit, rateLimitResponse } from '@/lib/rateLimit';",
    "const clientKey = () => 'test'; const rateLimit = async () => { throw Error('Unexpected rate limiter'); }; const rateLimitResponse = () => new Response('', { status: 429 });",
  ],
]);

let mockedSource = source;
for (const [target, replacement] of stubs.entries()) {
  assert.ok(mockedSource.includes(target), 'Expected import not found: ' + target);
  mockedSource = mockedSource.replace(target, replacement);
}
assert.doesNotMatch(mockedSource, /^import .* from /m);
const { GET } = await import('data:text/javascript,' + encodeURIComponent(mockedSource));

test('annual API rejects malformed, empty and out-of-range years with HTTP 400 before auth/DB', async () => {
  for (const year of ['abc', '', '2200', '1899', '2101', '2026.5', ' 2026', '0000']) {
    const request = new Request(
      'https://preview.example.test/api/profiles/username/devtest/yearly-top?year=' +
      encodeURIComponent(year)
    );
    const response = await GET(request, { params: { username: 'devtest' } });
    assert.equal(response.status, 400, 'Unexpected HTTP response for year=' + JSON.stringify(year));
    assert.deepEqual(await response.json(), { error: 'Invalid year' });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('an invalid year is rejected consistently for a private-profile URL', async () => {
  const response = await GET(
    new Request('https://preview.example.test/api/profiles/username/privateuser/yearly-top?year=2200'),
    { params: { username: 'privateuser' } }
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid year' });
});
