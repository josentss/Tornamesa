import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { upsertAlbumFromSpotify } from '@/lib/albumResolve';
import { readCachedAlbumDetails, storeCachedAlbumDetails } from '@/lib/albumDetailCache';

export const dynamic = 'force-dynamic';
const ID = /^[a-zA-Z0-9]{22}$/;

function fallbackAlbum(row) {
  const mins = Math.round((row.duration_ms || 0) / 60000);
  return {
    id: row.spotify_id,
    title: row.title,
    artist: row.artist || 'Unknown',
    coverUrl: row.cover_url || null,
    genres: [],
    releaseDate: 'N/A',
    totalDuration: mins > 0 ? `${mins} min` : 'N/A',
    tracks: [],
    spotifyUrl: `https://open.spotify.com/album/${row.spotify_id}`,
    cached: true,
    metadataStatus: 'basic',
  };
}

function formatTrack(track) {
  const ms = Math.max(0, Number(track?.duration_ms) || 0);
  return {
    name: track?.name || 'Unknown track',
    duration: `${Math.floor(ms / 60000)}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}`,
  };
}

export async function GET(request, { params }) {
  const { id } = params;
  if (!ID.test(String(id || ''))) {
    return NextResponse.json({ error: 'Invalid Spotify album ID' }, { status: 400 });
  }

  // Complete/partial Spotify details are stored temporarily (1 hour).
  // Basic album catalog data is persistent, and never represents a tracklist.
  const detail = await readCachedAlbumDetails(id);
  if (detail) return NextResponse.json(detail);

  const supabase = createSupabaseServer();
  const { data: local, error: localError } = await supabase.from('albums')
    .select('spotify_id, title, artist, cover_url, duration_ms')
    .eq('spotify_id', id).maybeSingle();
  if (localError) {
    console.error('album catalog read:', localError);
    return NextResponse.json({ error: 'Album lookup failed' }, { status: 503 });
  }

  const fallback = () => local
    ? NextResponse.json(fallbackAlbum(local))
    : NextResponse.json({ error: 'Album details are temporarily unavailable' }, { status: 503 });

  // Explicitly offline (for testing and degraded operation): 0 Spotify calls.
  const url = new URL(request.url);
  if (url.searchParams.get('local') === '1') return fallback();

  try {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}`
    );
    if (!res.ok) {
      if (res.status !== 429 && res.status !== 404) {
        console.warn('Spotify album request failed:', res.status);
      }
      return fallback();
    }

    const album = await res.json();
    const trackPage = album.tracks || {};
    const tracks = Array.isArray(trackPage.items) ? [...trackPage.items] : [];
    let next = typeof trackPage.next === 'string' ? trackPage.next : null;
    const total = Number(trackPage.total);
    // Small, strictly bounded pagination: never prefetch hundreds of tracks
    // or chase arbitrary URLs returned by a remote service.
    for (let page = 0; next && page < 2; page++) {
      const parsed = new URL(next);
      if (parsed.origin !== 'https://api.spotify.com' ||
          !parsed.pathname.startsWith(`/v1/albums/${id}/tracks`)) break;
      const r = await spotifyFetch(parsed.toString());
      if (!r.ok) break;
      const data = await r.json();
      tracks.push(...(Array.isArray(data.items) ? data.items : []));
      next = typeof data.next === 'string' ? data.next : null;
    }

    const complete = !next && (!Number.isFinite(total) || tracks.length >= total);
    const totalMs = tracks.reduce((sum, t) => sum + (Number(t.duration_ms) || 0), 0);
    // Never show a partial duration as if it were complete.
    const durationMs = complete && totalMs > 0 ? totalMs : (local?.duration_ms || 0);

    const details = {
      id,
      title: album.name || local?.title || 'Unknown album',
      artist: album.artists?.[0]?.name || local?.artist || 'Unknown',
      genres: [], // Avoid an extra artist lookup merely for decorative tags.
      coverUrl: album.images?.[0]?.url || local?.cover_url || null,
      releaseDate: album.release_date ? String(album.release_date).split('-')[0] : 'N/A',
      totalDuration: durationMs > 0
        ? `${Math.round(durationMs / 60000)} min`
        : 'N/A',
      tracks: tracks.map(formatTrack),
      spotifyUrl: album.external_urls?.spotify ||
        `https://open.spotify.com/album/${id}`,
      metadataStatus: complete ? 'complete' : 'partial',
      cached: false,
    };

    // Keep album catalog for lookups without losing existing durations.
    // Only a complete page of tracks is allowed to update duration_ms.
    if (complete) {
      await upsertAlbumFromSpotify({ ...album, tracks: { ...trackPage, items: tracks, next: null } })
        .catch((e) => console.warn('album duration upsert:', e.message));
    }
    await storeCachedAlbumDetails(id, details);
    return NextResponse.json(details);
  } catch (e) {
    console.warn('album detail fallback:', e.message);
    return fallback();
  }
}
