import { NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

function mapAlbum(album) {
  if (!album?.id) return null;
  return {
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name || 'Unknown',
    coverUrl: album.images?.[0]?.url || null,
    releaseDate: album.release_date || 'N/A',
    spotifyLink: album.external_urls?.spotify || '',
  };
}

function extractAlbumId(input) {
  const s = String(input).trim();

  const urlMatch = s.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?album\/([a-zA-Z0-9]{22})(?:\?|$|\/)/i
  );
  if (urlMatch) return urlMatch[1];

  const uriMatch = s.match(/spotify:album:([a-zA-Z0-9]{22})/i);
  if (uriMatch) return uriMatch[1];

  // Only treat as id if it looks exactly like a Spotify id (not normal words)
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;

  return null;
}

async function fetchAlbumById(id) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${encodeURIComponent(id)}`
  );

  if (!response.ok) {
    if (response.status !== 404) {
      console.error('Spotify album by id failed:', response.status);
    }
    return null;
  }

  const album = await response.json();
  return mapAlbum(album);
}

async function searchOnce(q, limit = 20) {
  const url =
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}` +
    `&type=album&limit=${limit}`;

  const response = await spotifyFetch(url);

  if (response.status === 429) {
    console.warn('Spotify rate limited (search)');
    return [];
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('Spotify search failed:', response.status, text.slice(0, 200));
    return [];
  }

  const data = await response.json();
  return (data.albums?.items || []).map(mapAlbum).filter(Boolean);
}

function mergeById(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const album of list || []) {
      if (!album?.id || seen.has(album.id)) continue;
      seen.add(album.id);
      out.push(album);
    }
  }
  return out;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: 'Search must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const trimmed = q.trim();

    // 1) Paste Spotify album URL / URI / id → direct fetch
    const albumId = extractAlbumId(trimmed);
    if (albumId) {
      const album = await fetchAlbumById(albumId);
      return NextResponse.json(album ? [album] : []);
    }

    // 2) Primary search — same style that used to work
    const primary = await searchOnce(trimmed, 20);
    const batches = [primary];

    // 3) Extra strategies only if primary is weak (helps long / niche titles)
    if (primary.length < 5) {
      const extra = [];

      // album:"full query"
      extra.push(`album:${trimmed}`);

      // shortened long titles
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length >= 4) {
        extra.push(words.slice(0, 4).join(' '));
      }

      // Artist - Album
      const parts = trimmed.split(/\s+-\s+/);
      if (parts.length >= 2) {
        const artist = parts[0].trim();
        const album = parts.slice(1).join(' - ').trim();
        if (artist && album) {
          extra.push(`artist:${artist} album:${album}`);
        }
      }

      for (const eq of [...new Set(extra)]) {
        if (eq === trimmed) continue;
        const batch = await searchOnce(eq, 15);
        batches.push(batch);
        if (mergeById(batches).length >= 15) break;
      }
    }

    return NextResponse.json(mergeById(batches));
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
