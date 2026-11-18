import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const helperSource = read('../src/lib/importParseErrors.js');
const { describeImportParseError, hasImportParseErrors } = await import(
  'data:text/javascript,' + encodeURIComponent(helperSource)
);

// Run the actual .txt parser without network or database access.
const parserSource = read('../src/lib/notesImport.js')
  .replace("import { CATALOG_EXTRAS } from '@/lib/catalog-extras';", 'const CATALOG_EXTRAS = [];')
  .replace("import { zonedLocalToUtc } from '@/lib/timezone';",
    'const zonedLocalToUtc = (y, m, d, h, min, s) => new Date(Date.UTC(y, m-1, d, h, min, s));');
const { parseNotesFile } = await import(
  'data:text/javascript,' + encodeURIComponent(parserSource)
);

test('parser recognizes valid entry and records both malformed source lines', () => {
  const content = [
    'Discos escuchados',
    '1- In Rainbows, Radiohead',
    '51- Kid A, Radiohead',
    '1- Línea sin artista',
  ].join('\n');
  const parsed = parseNotesFile(content, '2026-05.txt');
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 5);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].title, 'In Rainbows');
  assert.equal(parsed.rows[0].lineIndex, 1);
  assert.deepEqual(parsed.parseErrors.map((e) => e.reason), [
    'invalid_count',
    'no_title_artist_separator',
  ]);
  assert.deepEqual(parsed.parseErrors.map((e) => e.lineIndex), [2, 3]);
});

test('invalid lines have actionable, nontechnical messages', () => {
  assert.match(describeImportParseError('invalid_count'), /1 and 50/);
  assert.match(describeImportParseError('no_title_artist_separator'), /comma or a dash/);
  assert.match(describeImportParseError('empty_title_or_artist'), /cannot be empty/);
  assert.match(describeImportParseError('no_count_prefix'), /Start the line with a count/);
  assert.match(describeImportParseError('unknown'), /format could not be read/);
});

test('confirmation is needed only when the source has parser errors', () => {
  assert.equal(hasImportParseErrors({ parseErrors: [{ reason: 'invalid_count' }] }), true);
  assert.equal(hasImportParseErrors({ parseErrors: [] }), false);
  assert.equal(hasImportParseErrors(null), false);
});

test('preview returns source errors even while valid rows are matched', () => {
  const preview = read('../src/app/api/import/notes/preview/route.js');
  const ui = read('../src/components/monthly-top/ImportLogsModal.jsx');
  assert.match(preview, /offset === 0\s*\?\s*parsed\.parseErrors/);
  assert.match(ui, /parseErrors: \[\.\.\.\(chunk\.parseErrors \|\| \[\]\)\]/);
  assert.match(ui, /parseErrors: \[\.\.\.acc\.parseErrors, \.\.\.\(chunk\.parseErrors \|\| \[\]\)\]/);
  assert.match(ui, /View rejected lines and reasons/);
  assert.match(ui, /describeImportParseError\(entry\.reason\)/);
  assert.match(ui, /checked=\{confirmedInvalidLines\}/);
  assert.match(ui, /hasImportParseErrors\(preview\) && !confirmedInvalidLines/);
  assert.match(ui, /setConfirmedInvalidLines\(false\)/);
});

test('commit refuses partial imports if source parse errors lack exact acknowledgement', () => {
  const api = read('../src/app/api/import/notes/commit/route.js');
  const ui = read('../src/components/monthly-top/ImportLogsModal.jsx');
  const client = read('../src/lib/api.js');
  assert.match(api, /parsed\.parseErrors\.length > 0/);
  assert.match(api, /body\.confirmedInvalidLines !== parsed\.parseErrors\.length/);
  assert.match(api, /status: 409/);
  assert.match(client, /JSON\.stringify\(\{ items, file, confirmedInvalidLines \}\)/);
  assert.match(ui, /api\.commitNotesImport\(/);
  assert.match(ui, /confirmedInvalidLines \? \(preview\?\.parseErrors\?\.length \|\| 0\) : 0/);
  assert.doesNotMatch(api, /DELETE FROM public\.listens/);
});
