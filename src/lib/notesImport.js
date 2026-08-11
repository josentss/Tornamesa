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
  'a-sides, Adrianne Lenker, Buck Meek': {
    title: 'a-sides',
    artist: 'Adrianne Lenker',
  },
  'a-sides, Adrianne Lenker': {
    title: 'a-sides',
    artist: 'Adrianne Lenker',
  },
  'Revolver, The Beatles': {
    title: 'Revolver',
    artist: 'The Beatles',
  },
};

export const SUSPICIOUS_ALBUM_RE =
  /\b(ukulele|ukelele|tribute|karaoke|cover version|covers|lullaby|piano tribute|8-bit|midi|complete on|for sleep|string quartet|yoga|music box)\b/i;

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripEditionTags(s) {
  return String(s || '')
    .replace(
      /\([^)]*(remaster|deluxe|expanded|anniversary|edition|original album|mix|bonus|legacy|special)[^)]*\)/gi,
      ' '
    )
    .replace(
      /\[[^\]]*(remaster|deluxe|expanded|anniversary|edition|original album|mix|bonus)[^\]]*\]/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function coreTitle(s) {
  return normalize(stripEditionTags(s))
    .replace(
      /\b(deluxe|expanded|remaster(ed)?|anniversary|edition|bonus|disk|disc|vol|volume|ftb|oknotok|original|album|mix)\b/g,
      ' '
    )
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titlesMatchLoose(noteTitle, albumTitle) {
  const a = normalize(noteTitle);
  const b = normalize(stripEditionTags(albumTitle));
  if (a && a === b) return true;
  const ca = coreTitle(noteTitle);
  const cb = coreTitle(albumTitle);
  return ca.length > 2 && ca === cb;
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

    const m = line.match(/^(\d+)\s*[-–—.:]\s*(.+)$/);
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
      if (lastComma !== -1) {
        title = rest.slice(0, lastComma).trim();
        artist = rest.slice(lastComma + 1).trim();
        parseVia = 'last_comma';
      } else {
        const dash = rest.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        if (dash) {
          title = dash[1].trim();
          artist = dash[2].trim();
          parseVia = 'dash';
        } else {
          parseErrors.push({
            line,
            reason: 'no_title_artist_separator',
            lineIndex,
          });
          continue;
        }
      }
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

  if (!rowTitle) return null;

  for (const entry of CATALOG_EXTRAS) {
    const titleN = normalize(entry.title);
    const coreN = coreTitle(entry.title);
    const artistN = normalize(entry.artist);

    if (titleN && titleN === rowTitle) {
      if (
        !artistN ||
        rowArtist.includes(artistN) ||
        artistN.includes(rowArtist)
      ) {
        return entry;
      }
    }

    if (coreN && coreN === rowCore && rowCore.length > 3) {
      if (
        !artistN ||
        rowArtist.includes(artistN) ||
        artistN.includes(rowArtist)
      ) {
        return entry;
      }
    }
  }

  for (const entry of CATALOG_EXTRAS) {
    const artistN = normalize(entry.artist);
    const keys = (entry.keywords || []).map((k) => normalize(k));

    const titleLikeKw = keys.some((k) => {
      if (k.length < 4) return false;
      if (
        artistN &&
        (k === artistN || artistN.includes(k) || k.includes(artistN))
      ) {
        return false;
      }
      return rowTitle.includes(k) || k.includes(rowTitle);
    });

    if (!titleLikeKw) continue;

    const artistOk =
      !artistN ||
      rowArtist.includes(artistN) ||
      artistN.includes(rowArtist);

    if (artistOk) return entry;
  }

  return null;
}

export function scoreAlbumMatch(row, album) {
  const nt = normalize(row.title);
  const ntCore = coreTitle(row.title);
  const na = normalize(row.artist);

  const albumTitleClean = stripEditionTags(album.name || '');
  const at = normalize(albumTitleClean);
  const atCore = coreTitle(album.name || '');
  const albumFull = `${album.name} ${(album.artists || [])
    .map((a) => a.name)
    .join(' ')}`;

  const artistNames = (album.artists || [])
    .map((a) => normalize(a.name))
    .filter(Boolean);

  let score = 0;

  if (at === nt) {
    score += 65;
  } else if (atCore === ntCore && ntCore.length > 2) {
    score += 58;
  } else if (at.startsWith(nt + ' ') || at.startsWith(ntCore + ' ')) {
    score += 10;
  } else if (at.includes(nt) || nt.includes(at)) {
    score += 20;
  } else if (atCore.includes(ntCore) || ntCore.includes(atCore)) {
    score += 16;
  }

  if (nt.length >= 3 && at.length > nt.length + 4 && at.includes(nt)) {
    score -= 32;
  }

  const artistExact = artistNames.some(
    (a) => a === na || a.includes(na) || na.includes(a)
  );
  if (artistExact) score += 40;
  else if (
    artistNames.some(
      (a) => a.slice(0, 5) === na.slice(0, 5) && na.length > 4
    )
  ) {
    score += 12;
  }

  const tTokens = new Set(ntCore.split(' ').filter((w) => w.length > 2));
  let overlap = 0;
  for (const t of atCore.split(' ').filter((w) => w.length > 2)) {
    if (tTokens.has(t)) overlap++;
  }
  score += Math.min(18, overlap * 4);

  if (SUSPICIOUS_ALBUM_RE.test(albumFull)) score -= 55;
  if (album.album_type === 'album') score += 4;
  if (album.album_type === 'single') score -= 4;
  if (album.album_type === 'compilation') score -= 12;

  return Math.max(0, Math.min(100, score));
}

export function buildSearchQueries(row) {
  const title = row.title.trim();
  const artist = row.artist.trim();
  const titleNoParens = title.replace(/\s*[([].*?[)\]]\s*/g, ' ').trim();
  const queries = [
    `${title} ${artist}`,
    `album:${title} artist:${artist}`,
    `"${title}" artist:${artist}`,
    `"${title}" ${artist}`,
  ];
  if (titleNoParens && titleNoParens !== title) {
    queries.push(`${titleNoParens} ${artist}`);
  }
  queries.push(`artist:${artist}`);
  queries.push(title);
  return [...new Set(queries.filter(Boolean))];
}

export function isTitleExtension(noteTitle, albumTitle) {
  const nt = normalize(noteTitle);
  const at = normalize(stripEditionTags(albumTitle));
  if (!nt || at === nt) return false;
  return at.includes(nt) && at.length >= nt.length + 4;
}

export function buildListenTimestamps(year, month, count, lineIndex = 0) {
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  const li = Math.max(0, Number(lineIndex) || 0);
  const times = [];

  for (let i = 0; i < n; i++) {
    const slot = li * 3 + i;
    const day = Math.min(28, 1 + (slot % 28));
    const hour = String(10 + (Math.floor(slot / 28) % 10)).padStart(2, '0');
    const minute = String((slot * 5) % 60).padStart(2, '0');
    const second = String((li + i) % 60).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    times.push(`${year}-${mm}-${dd}T${hour}:${minute}:${second}.000Z`);
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
