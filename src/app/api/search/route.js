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
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?album\/([a-zA-Z0-9]{22})/i
  );
  if (urlMatch) return urlMatch[1];

  const uriMatch = s.match(/spotify:album:([a-zA-Z0-9]{22})/i);
  if (uriMatch) return uriMatch[1];

  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;

  return null;
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
    const albumId = extractAlbumId(trimmed);

    // Paste URL / URI / id
    if (albumId) {
      const response = await spotifyFetch(
        `https://api.spotify.com/v1/albums/${albumId}`
      );
      if (!response.ok) return NextResponse.json([]);
      const album = await response.json();
      const mapped = mapAlbum(album);
      return NextResponse.json(mapped ? [mapped] : []);
    }

    // Same simple search that worked before (no include_external)
    const response = await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=album&limit=20`
    );

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited, try again in a moment' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Spotify search failed:', response.status, text.slice(0, 300));
      return NextResponse.json(
        { error: 'Search temporarily unavailable' },
        { status: 503 }
      );
    }

    const data = await response.json();
    const albums = (data.albums?.items || [])
      .map(mapAlbum)
      .filter(Boolean);

    return NextResponse.json(albums);
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
