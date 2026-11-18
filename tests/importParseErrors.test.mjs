import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const helperSource = read('../src/lib/importParseErrors.js');
const { describeImportParseError, hasImportParseErrors } = await import(
  'data:text/javascript,' + encodeURIComponent(helperSource)
);

const parserSource = read('../src/lib/notesImport.js')
  .replace("import { CATALOG_EXTRAS } from '@/lib/catalog-extras';", 'const CATALOG_EXTRAS = [];')
  .replace("import { zonedLocalToUtc } from '@/lib/timezone';",
    'const zonedLocalToUtc = (y, m, d, h, min, s) => new Date(Date.UTC(y, m-1, d, h, min, s));');
const { parseNotesFile } = await import(
  'data:text/javascript,' + encodeURIComponent(parserSource)
);

test('parser recognizes valid entry and rejects malformed source lines', () => {
  const parsed = parseNotesFile([
    'Discos escuchados',
    '1- In Rainbows, Radiohead',
    '51- Kid A, Radiohead',
    '1- Línea sin artista',
  ].join('\n'), '2026-05.txt');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].title, 'In Rainbows');
  assert.equal(parsed.rows[0].lineIndex, 1);
  assert.deepEqual(parsed.parseErrors.map((e) => e.reason), [
    'invalid_count', 'no_title_artist_separator',
  ]);
  assert.deepEqual(parsed.parseErrors.map((e) => e.lineIndex), [2, 3]);
});

test('short explanations stay available for skipped lines', () => {
  assert.match(describeImportParseError('invalid_count'), /between 1 and 50/);
  assert.match(describeImportParseError('no_title_artist_separator'), /comma or a dash/);
  assert.equal(hasImportParseErrors({ parseErrors: [{ reason: 'invalid_count' }] }), true);
  assert.equal(hasImportParseErrors({ parseErrors: [] }), false);
});

test('invalid lines appear as a collapsed, neutral details section', () => {
  const preview = read('../src/app/api/import/notes/preview/route.js');
  const ui = read('../src/components/monthly-top/ImportLogsModal.jsx');
  assert.match(preview, /offset === 0\s*\?\s*parsed\.parseErrors/);
  assert.match(ui, /parseErrors: \[\.\.\.\(chunk\.parseErrors \|\| \[\]\)\]/);
  assert.match(ui, /<details className="text-sm">\s*<summary className="text-stone-500 cursor-pointer">\s*Invalid lines/);
  assert.match(ui, /describeImportParseError\(entry\.reason\)/);
  assert.doesNotMatch(ui, /confirmedInvalidLines|setConfirmedInvalidLines|checkbox|amber-400\/5/);
});

test('valid lines import without confirmation while invalid ones remain excluded', () => {
  const commit = read('../src/app/api/import/notes/commit/route.js');
  const ui = read('../src/components/monthly-top/ImportLogsModal.jsx');
  const api = read('../src/lib/api.js');
  assert.doesNotMatch(commit, /confirmedInvalidLines|Invalid lines require confirmation/);
  assert.match(commit, /const byLine = new Map\(parsed\.rows\.map/);
  assert.match(commit, /!sourceRow \|\| !ALBUM_ID\.test\(albumId\)/);
  assert.match(commit, /count !== sourceRow\.count/);
  assert.match(commit, /lineIndices\.has\(lineIndex\)/);
  assert.match(commit, /invalidLinesSkipped: parsed\.parseErrors\.length/);
  assert.match(ui, /disabled=\{loading \|\| itemsToImport\(\)\.length === 0\}/);
  assert.match(ui, /api\.commitNotesImport\(payload, sourceFile\)/);
  assert.match(api, /body: JSON\.stringify\(\{ items, file \}\)/);
  assert.match(ui, /commitResult\.invalidLinesSkipped/);
});
