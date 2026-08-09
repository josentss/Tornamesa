import { NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';
import { matchCatalogExtras } from '@/lib/catalog-extras';

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

async function searchSpotify(query) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`
  );

  if (response.status === 429) {
    console.warn('Spotify rate limited');
    return [];
  }

  if (!response.ok) {
    console.error(`Spotify search failed with status ${response.status}`);
    return [];
  }

  const data = await response.json();

  return (data.albums?.items || [])
    .filter((album) => album && album.id)
    .map(mapAlbum)
    .filter(Boolean);
}

async function fetchAlbumById(id) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${id}`
  );
  if (!response.ok) return null;
  const album = await response.json();
  return mapAlbum(album);
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

    // 1) Normal Spotify search
    const fromSearch = await searchSpotify(trimmed);

    // 2) Curated extras (hidden / poorly ranked albums)
    const extraIds = matchCatalogExtras(trimmed);
    const extras = [];
    for (const id of extraIds) {
      // skip if already in search results
      if (fromSearch.some((a) => a.id === id)) continue;
      const album = await fetchAlbumById(id);
      if (album) extras.push(album);
    }

    // Extras first so the “hard to find” album is visible
    return NextResponse.json([...extras, ...fromSearch]);
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
