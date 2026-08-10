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

function extractAlbumId(q) {
  const s = String(q || '').trim();
  const fromUrl = s.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?album\/([a-zA-Z0-9]{22})/
  );
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;
  return null;
}

async function searchSpotify(query) {
  const params = new URLSearchParams({
    q: query,
    type: 'album',
    limit: '10',
  });

  const response = await spotifyFetch(
    `https://api.spotify.com/v1/search?${params.toString()}`
  );

  if (response.status === 429) {
    console.warn('Spotify rate limited');
    return [];
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`Spotify search failed ${response.status}:`, text);
    throw new Error(`Spotify search failed (${response.status})`);
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

    const directId = extractAlbumId(trimmed);
    if (directId) {
      const album = await fetchAlbumById(directId);
      return NextResponse.json(album ? [album] : []);
    }

    const fromSearch = await searchSpotify(trimmed);

    const extraIds = matchCatalogExtras(trimmed);
    const extras = [];
    for (const id of extraIds) {
      if (fromSearch.some((a) => a.id === id)) continue;
      const album = await fetchAlbumById(id);
      if (album) extras.push(album);
    }

    return NextResponse.json([...extras, ...fromSearch]);
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
