import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const route = readFileSync(new URL('../src/app/api/og/yearly/route.js', import.meta.url), 'utf8');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Tiny, locally generated 2×2 PNG; exercises the real <img> branch without network access.
const COVER_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU6bnDwMDAxMDAwMDAAAARMgGAsGEFiQAAAABJRU5ErkJggg==';

test('all yearly OG divs declare Satori-compatible layout, including expression-only text', () => {
  const openingTags = [...route.matchAll(/<div\b(?:(?!>).)*>/gs)];
  assert.ok(openingTags.length >= 35, 'Expected the entire image card tree, not a partial fragment');
  const missing = openingTags.filter(([tag]) => !/\bdisplay:\s*'(?:flex|none)'/.test(tag));
  assert.deepEqual(missing.map(([tag]) => tag.slice(0, 120)), [],
    'Every JSX div must specify display explicitly; text interpolation can create multiple children');
  assert.match(route, /\{'@' \+ clipped\(profile\.username, 30\)\}/);
  assert.match(route, /\{'×' \+ fmt\(winner\.count\) \+ ' listens'\}/);
  assert.match(route, /\{'×' \+ fmt\(item\.count\)\}/);
});

test('yearly PNG resolves before HTTP response, so Satori exceptions enter error handler', () => {
  assert.match(route, /const image = new ImageResponse\(/);
  assert.match(route, /const png = await image\.arrayBuffer\(\)/);
  assert.match(route, /return new Response\(png, \{/);
  assert.match(route, /'Content-Type': 'image\/png'/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(route, /return new ImageResponse\(/);
});

// Exercise the ACTUAL JSX subtree, not a hand-written simplified mock.
// Next's installed SWC transforms JSX for Node, and next/og renders it to PNG.
// No Supabase connection, login, Spotify request, or external album cover is needed.
function compileFixture({ filled }) {
  const helpersStart = route.indexOf('const NO_STORE =');
  const helpersEnd = route.indexOf('function errorResponse(', helpersStart);
  const coverStart = route.indexOf('function AlbumCover(');
  const coverEnd = route.indexOf('export async function GET(', coverStart);
  const renderStartToken = 'const image = new ImageResponse(';
  const renderStart = route.indexOf(renderStartToken);
  const renderEnd = route.indexOf('\n      { width: 1080, height: 1920, headers: NO_STORE }', renderStart);
  assert.ok(helpersStart >= 0 && helpersEnd > helpersStart);
  assert.ok(coverStart >= 0 && coverEnd > coverStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);

  const helpers = route.slice(helpersStart, helpersEnd);
  const cover = route.slice(coverStart, coverEnd);
  const jsxWithComma = route.slice(renderStart + renderStartToken.length, renderEnd).trimEnd();
  assert.match(jsxWithComma, /<\/div>,\s*$/);

  const fixture = filled
    ? {
        totalListens: 561, uniqueAlbums: 226, uniqueArtists: 145,
        albums: [
          { title: 'A Very Long Album Title That Needs Truncation', artist: 'An Artist', count: 31, cover: COVER_DATA_URL },
          { title: 'Album Two', artist: 'Artist Two', count: 17, cover: null },
          { title: 'Album Three', artist: 'Artist Three', count: 12, cover: null },
          { title: 'Album Four', artist: 'Artist Four', count: 9, cover: null },
          { title: 'Album Five', artist: 'Artist Five', count: 7, cover: null },
        ],
        topArtist: { name: 'Radiohead' }, peak: { month: 8, listens: 107 },
      }
    : {
        totalListens: 0, uniqueAlbums: 0, uniqueArtists: 0,
        albums: [], topArtist: null, peak: null,
      };

  const source = [
    "const React = require('react');",
    "const { ImageResponse } = require('next/og');",
    helpers,
    cover,
    "const profile = { username: 'test-account' };",
    'const year = 2025;',
    "const palette = { bg: '#0a0f16', surface: '#131e2c', border: '#2a3645', accent: '#7cc7e8', muted: '#9bacbd' };",
    'const payload = ' + JSON.stringify(fixture) + ';',
    'const summary = payload;',
    'const items = payload.albums;',
    'const topArtist = payload.topArtist;',
    'const peak = payload.peak;',
    'const winner = items[0];',
    'const others = items.slice(1);',
    'module.exports = async function renderFixture() {',
    'const image = new ImageResponse(',
    jsxWithComma,
    ' { width: 1080, height: 1920, headers: NO_STORE });',
    'return Buffer.from(await image.arrayBuffer());',
    '};',
  ].join('\n');

  const { transformSync } = require('next/dist/build/swc');
  const compiled = transformSync(source, {
    filename: 'yearly-og-test-fixture.jsx',
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      target: 'es2022',
      transform: { react: { runtime: 'classic' } },
    },
    module: { type: 'commonjs' },
  });
  const filename = fileURLToPath(new URL('./_yearly-og-runtime-fixture.cjs', import.meta.url));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(compiled.code, filename);
  return mod.exports;
}

test('real next/og renders yearly PNG for five albums and the empty state', async () => {
  for (const filled of [true, false]) {
    const png = await compileFixture({ filled })();
    assert.ok(png.length > 2000, 'Generated PNG must not be empty');
    assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE),
      'Real renderer must return valid PNG magic bytes');
    assert.equal(png.readUInt32BE(16), 1080, 'Image width');
    assert.equal(png.readUInt32BE(20), 1920, 'Image height');
  }
});
