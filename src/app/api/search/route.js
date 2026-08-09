import { NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

function mapAlbum(album) {
  if (!album || !album.id) return null;
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

  const trimmed = q.trim();

  try {
    const albumId = extractAlbumId(trimmed);
    if (albumId) {
      const albumRes = await spotifyFetch(
        `https://api.spotify.com/v1/albums/${albumId}`
      );
      if (!albumRes.ok) {
        const body = await albumRes.text();
        return NextResponse.json(
          {
            error: 'Could not load album',
            spotifyStatus: albumRes.status,
            detail: body.slice(0, 300),
          },
          { status: 503 }
        );
      }
      const album = await albumRes.json();
      const mapped = mapAlbum(album);
      return NextResponse.json(mapped ? [mapped] : []);
    }

    const searchUrl =
      'https://api.spotify.com/v1/search' +
      `?q=${encodeURIComponent(trimmed)}` +
      '&type=album&limit=20';

    const searchRes = await spotifyFetch(searchUrl);

    if (!searchRes.ok) {
      const body = await searchRes.text();
      console.error('Spotify search failed:', searchRes.status, body);
      return NextResponse.json(
        {
          error: 'Search temporarily unavailable',
          spotifyStatus: searchRes.status,
          detail: body.slice(0, 400),
        },
        { status: 503 }
      );
    }

    const data = await searchRes.json();
    const items = data?.albums?.items;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        {
          error: 'Unexpected Spotify response',
          detail: JSON.stringify(data).slice(0, 400),
        },
        { status: 503 }
      );
    }

    const albums = items.map(mapAlbum).filter(Boolean);
    return NextResponse.json(albums);
  } catch (error) {
    console.error('Search exception:', error);
    return NextResponse.json(
      {
        error: 'Search temporarily unavailable',
        detail: error?.message || String(error),
      },
      { status: 503 }
    );
  }
}
