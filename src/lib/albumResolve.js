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

export async function fetchSpotifyAlbumById(id) {
  const res = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${id}`
  );
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

  if (existing) {
    return mapDbRow(existing);
  }

  const raw = await fetchSpotifyAlbumById(id);
  if (!raw) return null;

  await upsertAlbumFromSpotify(raw);
  return mapSpotifyAlbum(raw);
}

export async function searchLocalAlbums(query, limit = 12) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const supabase = createSupabaseServer();
  const safe = q.replace(/%/g, '').replace(/,/g, ' ').slice(0, 80);

  const { data, error } = await supabase
    .from('albums')
    .select('spotify_id, title, artist, cover_url')
    .or(
      `title.ilike.%${safe}%,artist.ilike.%${safe}%`
    )
    .limit(limit);

  if (error) {
    console.warn('searchLocalAlbums:', error.message);
    return [];
  }

  return (data || []).map(mapDbRow).filter(Boolean);
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
    const err = new Error(`Spotify search ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const items = (data.albums?.items || []).filter((a) => a?.id);

  for (const album of items.slice(0, 10)) {
    try {
      await upsertAlbumFromSpotify(album);
    } catch {
      /* ignore */
    }
  }

  return items.map(mapSpotifyAlbum).filter(Boolean);
}
