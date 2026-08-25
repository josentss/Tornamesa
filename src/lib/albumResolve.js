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
export async function upsertAlbumFromSpotify(albumData) {
  if (!albumData?.id) return;
  try {
    const supabase = createSupabaseServer();
    const totalDuration = (albumData.tracks?.items || []).reduce(
      (acc, t) => acc + (t.duration_ms || 0),
      0
    );
    const { error } = await supabase.from('albums').upsert(
      {
        spotify_id: albumData.id,
        title: albumData.name,
        artist: albumData.artists?.[0]?.name || 'Unknown',
        cover_url: albumData.images?.[0]?.url || null,
        duration_ms: totalDuration || 0,
      },
      { onConflict: 'spotify_id' }
    );
    if (error) console.warn('upsertAlbumFromSpotify:', error.message);
  } catch (e) {
    console.warn('upsertAlbumFromSpotify:', e.message);
  }
}

export async function upsertAlbumMapped(mapped) {
  if (!mapped?.id) return;
  try {
    const supabase = createSupabaseServer();
    const { error } = await supabase.from('albums').upsert(
      {
        spotify_id: mapped.id,
        title: mapped.title || 'Unknown',
        artist: mapped.artist || 'Unknown',
        cover_url: mapped.coverUrl || null,
        duration_ms: 0,
      },
      { onConflict: 'spotify_id' }
    );
    if (error) console.warn('upsertAlbumMapped:', error.message);
  } catch (e) {
    console.warn('upsertAlbumMapped:', e.message);
  }
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

export async function getAlbumByIdResolved(id) {
  if (!id) return null;
  try {
    const supabase = createSupabaseServer();
    const { data: existing } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url, duration_ms')
      .eq('spotify_id', id)
      .maybeSingle();

    if (existing) return mapDbRow(existing);

    const raw = await fetchSpotifyAlbumById(id);
    if (!raw) return null;

    void upsertAlbumFromSpotify(raw);
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

    const minScore = q.length <= 3 ? 8 : 10;

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
export async function searchSpotifyAlbums(query, limit = 15) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];

  const take = clampSearchLimit(limit, 15);

  const url =
    `https://api.spotify.com/v1/search?type=album&q=${encodeURIComponent(q)}`;

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

  let items = rawItems.filter((a) => a && a.id);
  items = items.filter((a) => {
    const name = a.name || '';
    const artists = (a.artists || []).map((ar) => ar.name || '').join(' ');
    return !NOISE_RE.test(name) && !NOISE_RE.test(artists);
  });

  const mapped = items.map((album) => mapSpotifyAlbum(album)).filter(Boolean);
  void Promise.allSettled(mapped.map((m) => upsertAlbumMapped(m)));
  return mapped.slice(0, take);
}
