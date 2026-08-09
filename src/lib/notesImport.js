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
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function coreTitle(s) {
  return normalize(s)
    .replace(
      /\b(deluxe|expanded|remaster(ed)?|anniversary|edition|bonus|disk|disc|vol|volume|ftb|oknotok)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
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
  let lineIndex = 0;

  for (const line of lines) {
    lineIndex += 1;
    const m = line.match(/^(\d+)\s*[-–—]\s*(.+)$/);
    if (!m) {
      parseErrors.push({ line, reason: 'no_count_prefix', lineIndex });
      continue;
    }

    const count = Number(m[1]);
    const rest = m[2].trim();
    if (!count || count < 1 || count > 50) {
      parseErrors.push({ line, reason: 'invalid_count', lineIndex });
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
        parseErrors.push({ line, reason: 'no_comma', lineIndex });
        continue;
      }
      title = rest.slice(0, lastComma).trim();
      artist = rest.slice(lastComma + 1).trim();
    }

    if (!title || !artist) {
      parseErrors.push({ line, reason: 'empty_title_or_artist', lineIndex });
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
      lineIndex,
      orderKey: `${sourceFile}::${String(lineIndex).padStart(4, '0')}`,
    });
  }

  return { year, month, rows, parseErrors };
}

export function matchCatalogExtra(row) {
  const rowTitle = normalize(row.title);
  const rowCore = coreTitle(row.title);
  const rowArtist = normalize(row.artist);
  const q = normalize(`${row.title} ${row.artist}`);

  for (const entry of CATALOG_EXTRAS) {
    if (normalize(entry.title) === rowTitle) return entry;
    if (coreTitle(entry.title) === rowCore && rowCore.length > 4) return entry;
  }

  for (const entry of CATALOG_EXTRAS) {
    const keys = (entry.keywords || []).map((k) => normalize(k));
    const titleN = normalize(entry.title);
    const artistN = normalize(entry.artist);
    const kwHit = keys.some((k) => k.length >= 4 && q.includes(k));
    const titleHit =
      titleN.length >= 6 &&
      (rowTitle.includes(titleN.slice(0, 16)) ||
        titleN.includes(rowTitle.slice(0, 16)));
    const artistHit =
      artistN &&
      (rowArtist.includes(artistN) ||
        artistN.includes(rowArtist) ||
        q.includes(artistN));

    if (titleHit && artistHit) return entry;
    if (kwHit && artistHit) return entry;
  }
  return null;
}

export function scoreAlbumMatch(row, album) {
  const nt = normalize(row.title);
  const ntCore = coreTitle(row.title);
  const na = normalize(row.artist);
  const at = normalize(album.name);
  const atCore = coreTitle(album.name);

  const artistNames = (album.artists || [])
    .map((a) => normalize(a.name))
    .filter(Boolean);
  const aa = artistNames[0] || '';

  let score = 0;

  if (at === nt) score += 55;
  else if (atCore === ntCore && ntCore.length > 3) score += 50;
  else if (at.includes(nt) || nt.includes(at)) score += 30;
  else if (atCore.includes(ntCore) || ntCore.includes(atCore)) score += 25;

  const artistExact = artistNames.some(
    (a) => a === na || a.includes(na) || na.includes(a)
  );
  if (artistExact) score += 40;
  else if (aa && (aa.includes(na.slice(0, 6)) || na.includes(aa.slice(0, 6)))) {
    score += 15;
  }

  const tTokens = new Set(ntCore.split(' ').filter((w) => w.length > 2));
  let overlap = 0;
  for (const t of atCore.split(' ').filter((w) => w.length > 2)) {
    if (tTokens.has(t)) overlap++;
  }
  score += Math.min(20, overlap * 4);

  if (album.album_type === 'album') score += 3;
  if (album.album_type === 'single') score -= 5;

  return Math.min(score, 100);
}

export function buildSearchQueries(row) {
  const title = row.title.trim();
  const artist = row.artist.trim();
  const titleNoParens = title.replace(/\s*[([].*?[)\]]\s*/g, ' ').trim();
  const queries = [
    `${title} ${artist}`,
    `album:${title} artist:${artist}`,
    `"${title}" ${artist}`,
  ];
  if (titleNoParens && titleNoParens !== title) {
    queries.push(`${titleNoParens} ${artist}`);
  }
  queries.push(title);
  return [...new Set(queries.filter(Boolean))];
}

export function buildListenTimestamps(year, month, count) {
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  const times = [];
  for (let i = 0; i < n; i++) {
    const day = Math.min(28, 1 + Math.floor((i * 28) / n));
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const minute = String((i * 7) % 60).padStart(2, '0');
    times.push(`${year}-${mm}-${dd}T12:${minute}:00.000Z`);
  }
  return times;
}

export function sortByNotesOrder(list) {
  return [...list].sort((a, b) => {
    const fa = String(a.sourceFile || '');
    const fb = String(b.sourceFile || '');
    if (fa !== fb) return fa.localeCompare(fb);
    return (a.lineIndex || 0) - (b.lineIndex || 0);
  });
}
