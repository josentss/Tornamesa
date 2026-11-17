import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';

// text helpers
export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSpotifyAlbumId(q) {
  const s = String(q || '').trim();
  const fromUrl = s.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?album\/([a-zA-Z0-9]{22})/i
  );
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;
  return null;
}

const NOISE_RE =
  /\b(tribute|karaoke|performs|string quartet|piano tribute|lullaby|cover version|music box|8.?bit|vs\.?|vitamin string|molotov cocktail|done again|the karaoke channel|complete on ukulele)\b/i;

function sanitizeIlike(s) {
  return String(s || '')
    .replace(/%/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function clampSearchLimit(limit, fallback = 15) {
  const n = Math.floor(Number(limit));
  if (!Number.isFinite(n)) return fallback;
  if (n < 1) return 1;
  if (n > 50) return 50;
  return n;
}

// mappers
function mapSpotifyAlbum(album) {
  if (!album?.id) return null;
  return {
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name || 'Unknown',
    coverUrl: album.images?.[0]?.url || null,
    releaseDate: album.release_date
      ? String(album.release_date).split('-')[0]
      : 'N/A',
    spotifyLink: album.external_urls?.spotify || '',
  };
}

function mapDbRow(row) {
  if (!row?.spotify_id) return null;
  return {
    id: row.spotify_id,
    title: row.title,
    artist: row.artist || 'Unknown',
    coverUrl: row.cover_url || null,
    releaseDate: 'N/A',
    spotifyLink: `https://open.spotify.com/album/${row.spotify_id}`,
    source: 'db',
  };
}

// scoring - no dupe
export function scoreLocalMatch(query, row) {
  const q = normalizeText(query);
  const title = normalizeText(row.title);
  const artist = normalizeText(row.artist);

  if (NOISE_RE.test(row.title || '') || NOISE_RE.test(row.artist || '')) {
    return -50;
  }

  let score = 0;

  if (artist === q) score += 100;
  else if (artist.startsWith(q + ' ') || artist.startsWith(q)) score += 55;
  else if (q.length >= 3 && artist.includes(q)) score += 22;

  if (title === q) score += 70;
  else if (title.startsWith(q)) score += 35;
  else if (q.length >= 3 && title.includes(q)) score += 15;

  const tokens = q.split(' ').filter((t) => t.length > 1);
  for (const t of tokens) {
    if (artist === t || artist.startsWith(t + ' ')) score += 12;
    else if (artist.includes(t)) score += 3;
    if (title.includes(t)) score += 4;
  }

  if (artist.split(' ').length > 6 && !artist.startsWith(q)) score -= 15;

  return score;
}

export function albumDedupeKey(a) {
  return `${normalizeText(a.title)}|${normalizeText(a.artist)}`;
}

export function dedupeAlbums(list) {
  const byId = new Set();
  const byKey = new Set();
  const out = [];
  for (const a of list || []) {
    if (!a?.id || byId.has(a.id)) continue;
    const key = albumDedupeKey(a);
    if (byKey.has(key)) continue;
    byId.add(a.id);
    byKey.add(key);
    out.push(a);
  }
  return out;
}

// upserts
// A search hit is BASIC metadata. Never overwrite an existing complete row
// (especially duration_ms) with the placeholder zero from search results.
export async function upsertAlbumsMapped(mappedAlbums) {
  const rows = [...new Map(
    (mappedAlbums || [])
      .filter((m) => /^[a-zA-Z0-9]{22}$/.test(m?.id || ''))
      .map((m) => [m.id, {
        spotify_id: m.id,
        title: m.title || 'Unknown',
        artist: m.artist || 'Unknown',
        cover_url: m.coverUrl || null,
        duration_ms: 0,
      }])
  ).values()];
  if (!rows.length) return;
  const supabase = createSupabaseServer();
  const { error } = await supabase.from('albums').upsert(rows, {
    onConflict: 'spotify_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function upsertAlbumMapped(mapped) {
  return upsertAlbumsMapped([mapped]);
}

export async function upsertAlbumFromSpotify(albumData) {
  if (!albumData?.id) return;
  const supabase = createSupabaseServer();
  const { data: existing, error: readError } = await supabase
    .from('albums')
    .select('duration_ms')
    .eq('spotify_id', albumData.id)
    .maybeSingle();
  if (readError) throw readError;

  const page = albumData.tracks;
  const tracks = Array.isArray(page?.items) ? page.items : [];
  const complete = page && !page.next &&
    (!Number.isFinite(page.total) || tracks.length >= page.total);
  const duration = complete
    ? tracks.reduce((acc, t) => acc + (Number(t.duration_ms) || 0), 0)
    : 0;
  const { error } = await supabase.from('albums').upsert({
    spotify_id: albumData.id,
    title: albumData.name || 'Unknown',
    artist: albumData.artists?.[0]?.name || 'Unknown',
    cover_url: albumData.images?.[0]?.url || null,
    duration_ms: duration > 0 ? duration : (existing?.duration_ms || 0),
  }, { onConflict: 'spotify_id' });
  if (error) throw error;
}

// resolve por id
export async function fetchSpotifyAlbumById(id) {
  try {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.warn('fetchSpotifyAlbumById:', e.message);
    return null;
  }
}

export async function getAlbumByIdResolved(id, { allowSpotify = true } = {}) {
  if (!id) return null;
  try {
    const supabase = createSupabaseServer();
    const { data: existing } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url, duration_ms')
      .eq('spotify_id', id)
      .maybeSingle();

    if (existing) return mapDbRow(existing);
    if (!allowSpotify) return null;

    const raw = await fetchSpotifyAlbumById(id);
    if (!raw) return null;

    await upsertAlbumFromSpotify(raw);
    return mapSpotifyAlbum(raw);
  } catch (e) {
    console.warn('getAlbumByIdResolved:', e.message);
    return null;
  }
}

// local search
export async function searchLocalAlbums(query, limit = 15) {
  const q = sanitizeIlike(query);
  if (q.length < 2) return [];

  const take = clampSearchLimit(limit, 15);

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .limit(Math.max(take * 4, 40));

    if (error) {
      console.warn('searchLocalAlbums:', error.message);
      return [];
    }

    const minScore = q.length <= 3 ? 5 : 8;

    return (data || [])
      .map((row) => ({
        album: mapDbRow(row),
        score: scoreLocalMatch(q, row),
      }))
      .filter((x) => x.album && x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, take)
      .map((x) => ({ ...x.album, _score: x.score }));
  } catch (e) {
    console.warn('searchLocalAlbums:', e.message);
    return [];
  }
}

export async function searchLocalByTitleArtist(title, artist, limit = 15) {
  const t = sanitizeIlike(title);
  const a = sanitizeIlike(artist);
  if (t.length < 1 && a.length < 1) return [];

  const take = clampSearchLimit(limit, 15);

  try {
    const supabase = createSupabaseServer();

    if (t.length >= 2 && a.length >= 2) {
      const { data, error } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .ilike('title', `%${t}%`)
        .ilike('artist', `%${a}%`)
        .limit(take);

      if (!error && data?.length) {
        return data.map(mapDbRow).filter(Boolean);
      }
    }

    if (t.length >= 2) {
      const { data, error } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .ilike('title', `%${t}%`)
        .limit(take);

      if (!error && data?.length) {
        return data.map(mapDbRow).filter(Boolean);
      }
    }

    if (a.length >= 2) {
      const { data, error } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .ilike('artist', `%${a}%`)
        .limit(take);

      if (!error && data?.length) {
        return data.map(mapDbRow).filter(Boolean);
      }
    }

    return [];
  } catch (e) {
    console.warn('searchLocalByTitleArtist:', e.message);
    return [];
  }
}

// spotify search
export async function searchSpotifyAlbums(query, limit = 15, { strictPersistence = false } = {}) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];

  // Development Mode supports at most 10 results per search request.
  const take = Math.min(10, clampSearchLimit(limit, 10));

  const url =
    `https://api.spotify.com/v1/search?type=album&limit=${take}&q=${encodeURIComponent(q)}`;

  const res = await spotifyFetch(url);

  if (res.status === 429) {
    const err = new Error('Spotify rate limit (search)');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(
      `Spotify search ${res.status}: ${text.slice(0, 300)} | url=${url}`
    );
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const rawItems = data?.albums?.items;
  if (!Array.isArray(rawItems)) return [];

  const items = rawItems.filter((a) => a && a.id);

  const mapped = items
    .map((album) => {
      const m = mapSpotifyAlbum(album);
      if (!m) return null;
      const blob = `${m.title} ${m.artist}`;
      return { ...m, _noise: NOISE_RE.test(blob) };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a._noise) - Number(b._noise));

  // Persist before returning: unawaited writes may never finish on Vercel.
  try {
    await upsertAlbumsMapped(mapped.map(({ _noise, ...m }) => m));
  } catch (e) {
    // Search can still return results, but Import Commit verifies each ID
    // exists locally, and will never fetch an unpersisted ID on commit.
    console.warn('Spotify search catalog persistence:', e.message);
    if (strictPersistence) throw e;
  }

  return mapped
    .map(({ _noise, ...rest }) => rest)
    .slice(0, take);
}
