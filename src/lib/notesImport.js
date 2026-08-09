import { CATALOG_EXTRAS } from '@/lib/catalog-extras';

export const LINE_OVERRIDES = {
  'PD. NOS VEMOS, YOSHI, Zizzy': {
    title: 'PD. NOS VEMOS',
    artist: 'YOSHI',
  },
  'When The Pawn..., Fionna Apple': {
    title: 'When the Pawn...',
    artist: 'Fiona Apple',
  },
  'Ants Form Up There, Black Country, New Road': {
    title: 'Ants From Up There',
    artist: 'Black Country, New Road',
  },
  'Aprin In Paris, Charlie Parker': {
    title: 'April in Paris',
    artist: 'Charlie Parker',
  },
  'Deathconciousness, Have A Nice Life': {
    title: 'Deathconsciousness',
    artist: 'Have a Nice Life',
  },
  'Island, King Crimson': {
    title: 'Islands',
    artist: 'King Crimson',
  },
};

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseNotesFile(content, sourceFile = '') {
  const monthMatch = String(sourceFile).match(/(20\d{2})-(\d{2})/);
  const year = monthMatch ? Number(monthMatch[1]) : null;
  const month = monthMatch ? Number(monthMatch[2]) : null;

  const lines = String(content)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^discos escuchados/i.test(l));

  const rows = [];
  const parseErrors = [];

  for (const line of lines) {
    const m = line.match(/^(\d+)\s*[-–—]\s*(.+)$/);
    if (!m) {
      parseErrors.push({ line, reason: 'no_count_prefix' });
      continue;
    }

    const count = Number(m[1]);
    const rest = m[2].trim();
    if (!count || count < 1 || count > 50) {
      parseErrors.push({ line, reason: 'invalid_count' });
      continue;
    }

    let title;
    let artist;
    let parseVia = 'last_comma';

    if (LINE_OVERRIDES[rest]) {
      title = LINE_OVERRIDES[rest].title;
      artist = LINE_OVERRIDES[rest].artist;
      parseVia = 'override';
    } else {
      const lastComma = rest.lastIndexOf(',');
      if (lastComma === -1) {
        parseErrors.push({ line, reason: 'no_comma' });
        continue;
      }
      title = rest.slice(0, lastComma).trim();
      artist = rest.slice(lastComma + 1).trim();
    }

    if (!title || !artist) {
      parseErrors.push({ line, reason: 'empty_title_or_artist' });
      continue;
    }

    rows.push({
      sourceFile,
      year,
      month,
      count,
      title,
      artist,
      raw: line,
      rest,
      parseVia,
    });
  }

  return { year, month, rows, parseErrors };
}

export function matchCatalogExtra(row) {
  const q = normalize(`${row.title} ${row.artist}`);
  const rowTitle = normalize(row.title);

  for (const entry of CATALOG_EXTRAS) {
    if (normalize(entry.title) === rowTitle) return entry;
  }

  for (const entry of CATALOG_EXTRAS) {
    const keys = (entry.keywords || []).map((k) => normalize(k));
    const titleN = normalize(entry.title);
    const artistN = normalize(entry.artist);
    const kwHit = keys.some((k) => k && q.includes(k));
    const titleHit = titleN && q.includes(titleN.slice(0, 18));
    const artistHit = artistN && q.includes(artistN);
    if ((kwHit || titleHit) && (artistHit || kwHit)) return entry;
  }
  return null;
}

export function scoreAlbumMatch(row, album) {
  const nt = normalize(row.title);
  const na = normalize(row.artist);
  const at = normalize(album.name);
  const aa = normalize(album.artists?.[0]?.name || '');

  let score = 0;
  if (at === nt) score += 50;
  else if (at.includes(nt) || nt.includes(at)) score += 25;

  if (aa === na) score += 40;
  else if (aa.includes(na) || na.includes(aa)) score += 20;

  const tTokens = new Set(nt.split(' ').filter((w) => w.length > 2));
  for (const t of at.split(' ').filter((w) => w.length > 2)) {
    if (tTokens.has(t)) score += 3;
  }
  return Math.min(score, 100);
}

/** Spread N listens across days 1..28 of the month (UTC noon). */
export function buildListenTimestamps(year, month, count) {
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  const times = [];
  for (let i = 0; i < n; i++) {
    const day = Math.min(28, 1 + Math.floor((i * 28) / n));
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    // slight minute offset so rows aren't identical
    const minute = String((i * 7) % 60).padStart(2, '0');
    times.push(`${year}-${mm}-${dd}T12:${minute}:00.000Z`);
  }
  return times;
}
