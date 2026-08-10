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
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('type', 'album');
  params.set('limit', '10');
  // market ayuda en algunos entornos de Client Credentials
  params.set('market', 'US');

  const url = `https://api.spotify.com/v1/search?${params.toString()}`;
  const response = await spotifyFetch(url);
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(
      `Spotify search ${response.status}: ${text?.slice(0, 300) || 'no body'}`
    );
    err.status = response.status;
    err.detail = text;
    throw err;
  }

  return (data?.albums?.items || [])
    .filter((album) => album && album.id)
    .map(mapAlbum)
    .filter(Boolean);
}

async function fetchAlbumById(id) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${id}?market=US`
  );
  if (!response.ok) return null;
  const album = await response.json();
  return mapAlbum(album);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const debug = searchParams.get('debug') === '1';

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

    const results = [...extras, ...fromSearch];

    if (debug) {
      return NextResponse.json({
        count: results.length,
        results,
        query: trimmed,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error.message, error.detail || '');
    return NextResponse.json(
      {
        error: 'Search temporarily unavailable',
        message: error.message || String(error),
        spotifyStatus: error.status || null,
      },
      { status: 503 }
    );
  }
}
