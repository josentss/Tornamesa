import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';

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

function sanitizeIlike(s) {
  return String(s || '')
    .replace(/%/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function scoreLocalMatch(query, row) {
  const q = normalizeText(query);
  const title = normalizeText(row.title);
  const artist = normalizeText(row.artist);
  const both = `${title} ${artist}`;
  let score = 0;

  if (title === q || both === q) score += 100;
  if (title.startsWith(q)) score += 40;
  if (title.includes(q)) score += 25;
  if (artist.includes(q)) score += 15;
  if (q.includes(title) && title.length >= 4) score += 20;

  const qTokens = q.split(' ').filter((t) => t.length > 1);
  for (const t of qTokens) {
    if (title.includes(t)) score += 4;
    if (artist.includes(t)) score += 2;
  }
  return score;
}

export async function upsertAlbumFromSpotify(albumData) {
  if (!albumData?.id) return;
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
}

export async function upsertAlbumMapped(mapped) {
  if (!mapped?.id) return;
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
}

export async function fetchSpotifyAlbumById(id) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getAlbumByIdResolved(id) {
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase
    .from('albums')
    .select('spotify_id, title, artist, cover_url, duration_ms')
    .eq('spotify_id', id)
    .maybeSingle();

  if (existing) return mapDbRow(existing);

  const raw = await fetchSpotifyAlbumById(id);
  if (!raw) return null;

  await upsertAlbumFromSpotify(raw);
  return mapSpotifyAlbum(raw);
}

export async function searchLocalAlbums(query, limit = 12) {
  const q = sanitizeIlike(query);
  if (q.length < 2) return [];

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from('albums')
    .select('spotify_id, title, artist, cover_url')
    .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
    .limit(Math.max(limit * 3, 30));

  if (error) {
    console.warn('searchLocalAlbums:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => ({ row, score: scoreLocalMatch(q, row) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => mapDbRow(x.row))
    .filter(Boolean);
}

export async function searchLocalByTitleArtist(title, artist, limit = 15) {
  const t = sanitizeIlike(title);
  const a = sanitizeIlike(artist);
  if (t.length < 1 && a.length < 1) return [];

  const supabase = createSupabaseServer();

  if (t.length >= 2 && a.length >= 2) {
    const { data, error } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .ilike('title', `%${t}%`)
      .ilike('artist', `%${a}%`)
      .limit(limit);

    if (!error && data?.length) {
      return data.map(mapDbRow).filter(Boolean);
    }
  }

  if (t.length >= 2) {
    const { data, error } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .ilike('title', `%${t}%`)
      .limit(limit);

    if (!error && data?.length) {
      return data.map(mapDbRow).filter(Boolean);
    }
  }

  if (a.length >= 2) {
    const { data, error } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .ilike('artist', `%${a}%`)
      .limit(limit);

    if (!error && data?.length) {
      return data.map(mapDbRow).filter(Boolean);
    }
  }

  return [];
}

export async function searchSpotifyAlbums(query) {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('type', 'album');
  params.set('limit', '10');

  const res = await spotifyFetch(
    `https://api.spotify.com/v1/search?${params.toString()}`
  );

  if (res.status === 429) {
    const err = new Error('Spotify rate limit (search)');
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(
      `Spotify search ${res.status}: ${text.slice(0, 200)}`
    );
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const items = (data.albums?.items || []).filter((a) => a?.id);
  const mapped = items.map(mapSpotifyAlbum).filter(Boolean);

  await Promise.allSettled(mapped.map((m) => upsertAlbumMapped(m)));

  return mapped;
}
