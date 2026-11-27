import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const React = require('react');
const { ImageResponse } = require('next/og');
const { transformSync } = require('next/dist/build/swc');
const path = '../src/components/yearly/YearlyWrappedCards.jsx';
const source = readFileSync(new URL(path, import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/app/api/og/yearly/route.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/[username]/yearly-top/page.js', import.meta.url), 'utf8');

const gallery = readFileSync(new URL('../src/components/yearly/YearlyWrappedGallery.jsx', import.meta.url), 'utf8');

function loadActualComponent() {
  const compiled = transformSync("const React = require('react');\n" + source, {
    filename: 'YearlyWrappedCards.jsx',
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      target: 'es2022',
      transform: { react: { runtime: 'classic' } },
    },
    module: { type: 'commonjs' },
  });
  const filename = fileURLToPath(new URL('./_yearly-story-runtime-fixture.cjs', import.meta.url));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(compiled.code, filename);
  return mod.exports;
}

const { YEARLY_THEMES, YEARLY_CARDS, STORY_LAYOUT, YearlyWrappedCard } = loadActualComponent();
const COVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU6bnDwMDAxMDAwMDAAAARMgGAsGEFiQAAAABJRU5ErkJggg==';
const albums = Array.from({ length: 5 }, (_, i) => ({
  title: i === 0 ? 'fabiola' : 'Very Long Album Title Number ' + (i + 1),
  artist: i === 0 ? 'suei' : 'Long Artist Name Group ' + (i + 1),
  count: [31, 18, 14, 12, 12][i], cover: i === 0 ? COVER : null,
}));
const artists = [
  { name: 'Radiohead', listens: 68, albums: 12 },
  { name: 'suei', listens: 43, albums: 5 },
  { name: 'King Crimson', listens: 30, albums: 4 },
  { name: 'AKRIILA', listens: 21, albums: 2 },
  { name: 'Madlib', listens: 11, albums: 1 },
];
const summary = {
  totalListens: 561, uniqueAlbums: 226, uniqueArtists: 145,
  discoveries: 226, repeatListens: 335,
};
const monthly = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1, listens: [0,0,30,64,42,38,58,107,68,54,61,39][i],
}));
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

test('the image endpoint validates card and color before owner data and preserves auth', () => {
  assert.match(route, /Object\.hasOwn\(YEARLY_CARDS, card\)/);
  assert.match(route, /Object\.hasOwn\(YEARLY_THEMES, themeName\)/);
  assert.ok(route.indexOf('Invalid yearly card or theme') < route.indexOf('await getRequestUser(request)'));
  assert.ok(route.indexOf("canViewWithFollows(supabase, viewer, profile, 'top')") < route.indexOf("supabase.rpc('top_albums'"));
  assert.match(route, /p_limit: 5/);
  assert.match(route, /supabase\.rpc\('yearly_top_stats'/);
  assert.match(route, /await image\.arrayBuffer\(\)/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
});

test('four named themes and exactly five story types are available', () => {
  assert.deepEqual(Object.keys(YEARLY_THEMES), ['night','ocean','violet','moss']);
  assert.deepEqual(Object.keys(YEARLY_CARDS), ['summary','album','albums','artists','insights']);
  assert.ok(Object.values(YEARLY_THEMES).every((theme) =>
    /^#[a-f0-9]{6}$/i.test(theme.bg) && /^#[a-f0-9]{6}$/i.test(theme.accent)));
});

test('Wrapped opens one modal gallery and preserves the share link', () => {
  assert.match(page, /Share link/);
  assert.match(page, /View Wrapped/);
  assert.match(page, /aria-haspopup="dialog"/);
  assert.match(page, /<YearlyWrappedGallery/);
  assert.doesNotMatch(page, /id="wrapped-card"|Preview image/);
  assert.match(gallery, /<dialog ref=\{dialog\}/);
  assert.match(gallery, /node\.showModal\(\)/);
  assert.match(gallery, /onCancel=\{\(event\) => \{ event\.preventDefault\(\); onClose\(\); \}\}/);
  assert.match(gallery, /opener\.focus\(\)/);
  assert.match(gallery, /document\.body\.style\.overflow = originalOverflow/);
  assert.match(gallery, /aria-roledescription="carousel"/);
  assert.match(gallery, /snap-x snap-mandatory overflow-x-auto/);
  assert.match(gallery, /onScroll=\{handleScroll\}/);
  assert.match(gallery, /Math\.round\(node\.scrollLeft \/ node\.clientWidth\)/);
  assert.match(gallery, /event\.key === "ArrowRight"/);
  assert.match(gallery, /aria-current=\{i === index/);
  assert.match(gallery, /aria-pressed=\{color === item\.id\}/);
  assert.match(gallery, /useState\("night"\)/);
  assert.match(gallery, /useState\(0\)/);
  assert.match(api, /params\.set\('card', card\)/);
  assert.match(api, /params\.set\('theme', theme\)/);
});

test('preview requests are scoped to the active card and color and never repeated by export', () => {
  assert.match(gallery, /const key = cacheKey\(card, color\)/);
  assert.match(gallery, /result\?\.key === key \? result : null/);
  assert.match(gallery, /if \(scrolling\) return/);
  assert.match(gallery, /const cached = cache\.current\.get\(key\)/);
  assert.match(gallery, /controller\.abort\(\)/);
  assert.match(gallery, /controller\.signal\.aborted \|\| !mounted\.current/);
  assert.match(gallery, /cache\.current\.clear\(\)/);
  assert.match(gallery, /for \(const entry of cache\.current\.values\(\)\) URL\.revokeObjectURL\(entry\.url\)/);
  assert.match(gallery, /const image = current\.blob/);
  const exporter = gallery.slice(gallery.indexOf('async function exportImage'), gallery.indexOf('  return (\n    <dialog'));
  assert.doesNotMatch(exporter, /getYearlyTopImage|fetch\(/);
  assert.match(api, /getYearlyTopImage: async \(username, \{ year, card = 'summary', theme = 'night', signal \}/);
  assert.match(api, /Retry-After/);
});

test('the actual story templates render valid 1080×1920 PNGs with five albums', async () => {
  for (const card of ['summary', 'album', 'albums', 'artists', 'insights']) {
    const element = React.createElement(YearlyWrappedCard, {
      card, theme: 'night', year: 2025, username: 'josents',
      summary, items: albums, topArtists: artists, monthly,
    });
    const response = new ImageResponse(element, { width: 1080, height: 1920 });
    const png = Buffer.from(await response.arrayBuffer());
    assert.ok(png.length > 2000, card + ' PNG is not empty');
    assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE), card + ' has valid PNG header');
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1920);
  }
});

test('a different palette and an empty year render without synthetic records', async () => {
  const element = React.createElement(YearlyWrappedCard, {
    card: 'album', theme: 'violet', year: 2026, username: 'guest',
    summary: { totalListens: 0, uniqueAlbums: 0, uniqueArtists: 0,
      discoveries: 0, repeatListens: 0 },
    items: [], topArtists: [], monthly: [],
  });
  const png = Buffer.from(await new ImageResponse(element,
    { width: 1080, height: 1920 }).arrayBuffer());
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
});

test('story preview stays vertical and prevents exporting stale colors', () => {
  assert.match(gallery, /aspect-\[9\/16\]/);
  assert.match(gallery, /previousByCard\.current\.get\(id\)/);
  assert.match(gallery, /const ready = !!current\?\.url && !scrolling && !sharing/);
  assert.match(gallery, /disabled=\{!ready\}/);
  assert.doesNotMatch(gallery, /id: "ember"|id: "forest"/);
});

test('all four themes and each empty story render real 9:16 PNGs', async () => {
  for (const [card, theme] of [
    ['summary', 'ocean'], ['album', 'ocean'], ['albums', 'violet'], ['artists', 'moss'], ['insights', 'ocean'],
    ['summary', 'night'], ['albums', 'night'], ['artists', 'night'], ['insights', 'night'],
  ]) {
    const filled = theme !== 'night';
    const element = React.createElement(YearlyWrappedCard, {
      card, theme, year: 2025, username: 'test-account',
      summary: filled ? summary : { totalListens: 0, uniqueAlbums: 0, uniqueArtists: 0, discoveries: 0, repeatListens: 0 },
      items: filled ? albums : [], topArtists: filled ? artists : [], monthly: filled ? monthly : [],
    });
    const png = Buffer.from(await new ImageResponse(element, { width: 1080, height: 1920 }).arrayBuffer());
    assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1920);
  }
});

test('fixed frame reserves explicit safe areas and story sections', () => {
  const l = STORY_LAYOUT;
  assert.equal(2*l.paddingY + l.header + l.headerGap + l.body + l.footerGap + l.footer, l.height);
  assert.equal(l.width - 2*l.paddingX, 920);
});
test('long multilingual labels, large totals and a single album render real PNGs', async () => {
  const long = [{ title: '非常に長いアルバムの名前 — In The Court Of The Crimson King (Expanded & Remastered Original Album Mix)',
    artist: 'A very long collaboration name with several artists', count: 123456, cover: COVER }];
  for (const card of ['summary', 'album', 'albums', 'artists', 'insights']) {
    const element = React.createElement(YearlyWrappedCard, {
      card, theme: 'moss', year: 2026, username: 'very-long-username-for-testing',
      summary: { totalListens: 123456, uniqueAlbums: 12345, uniqueArtists: 9876, discoveries: 12345, repeatListens: 111111 },
      items: long, topArtists: [{ name: long[0].artist, listens: 123456, albums: 1 }], monthly,
    });
    const png = Buffer.from(await new ImageResponse(element, { width: 1080, height: 1920 }).arrayBuffer());
    assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE));
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1920);
  }
});
