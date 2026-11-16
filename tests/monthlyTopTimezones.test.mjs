import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tzSource = readFileSync(new URL('../src/lib/timezone.js', import.meta.url), 'utf8');
const tz = await import(`data:text/javascript,${encodeURIComponent(tzSource)}`);

const notesSource = readFileSync(new URL('../src/lib/notesImport.js', import.meta.url), 'utf8');
const notesScript = notesSource
  .replace("import { CATALOG_EXTRAS } from '@/lib/catalog-extras';", 'const CATALOG_EXTRAS = [];')
  .replace("import { zonedLocalToUtc } from '@/lib/timezone';", tzSource);
const notes = await import(`data:text/javascript,${encodeURIComponent(notesScript)}`);

test('month boundaries follow the profile zone, including daylight saving time', () => {
  assert.deepEqual(tz.zonedMonthRange(2026, 3, 'America/New_York'), {
    start: '2026-03-01T05:00:00.000Z',
    end: '2026-04-01T04:00:00.000Z',
  });
  assert.deepEqual(tz.zonedMonthRange(2026, 3, 'America/Bogota'), {
    start: '2026-03-01T05:00:00.000Z',
    end: '2026-04-01T05:00:00.000Z',
  });
});

test('week grouping uses local month rather than UTC midnight', () => {
  const iso = '2026-03-01T03:00:00.000Z';
  assert.deepEqual(tz.monthsFromIsoInZone(iso, 'America/Bogota'), [
    { year: 2026, month: 2 },
  ]);
  assert.equal(tz.weekOfMonthInZone(iso, 'America/Bogota'), 4);
  assert.equal(tz.weekOfMonthInZone('2026-03-29T12:00:00Z', 'UTC'), 5);
});

test('note imports keep the chosen local month, including positive UTC offsets', () => {
  const bogota = notes.buildListenTimestamps(2026, 1, 2, 0, 'America/Bogota');
  assert.deepEqual(bogota, [
    '2026-01-01T05:00:00.000Z',
    '2026-01-01T05:00:02.000Z',
  ]);
  const kir = notes.buildListenTimestamps(2026, 1, 1, 0, 'Pacific/Kiritimati');
  assert.equal(kir[0], '2025-12-31T10:00:00.000Z');
  assert.deepEqual(tz.monthsFromIsoInZone(kir[0], 'Pacific/Kiritimati'), [
    { year: 2026, month: 1 },
  ]);
});

test('existing UTC import timestamps stay unchanged by default', () => {
  assert.equal(notes.buildListenTimestamps(2026, 1, 1, 0)[0], '2026-01-01T00:00:00.000Z');
});
