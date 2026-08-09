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

async function fetchAlbumById(id) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${id}`
  );

  if (response.status === 404) return null;
  if (response.status === 429) {
    console.warn('Spotify rate limited (album by id)');
    return null;
  }
  if (!response.ok) {
    console.error('Spotify album by id failed:', response.status);
    return null;
  }

  const album = await response.json();
  return mapAlbum(album);
}

async function searchOnce(q, limit = 20) {
  const url =
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}` +
    `&type=album&limit=${limit}&include_external=audio`;

  const response = await spotifyFetch(url);

  if (response.status === 429) {
    console.warn('Spotify rate limited (search)');
    return [];
  }
  if (!response.ok) {
    console.error('Spotify search failed:', response.status);
    return [];
  }

  const data = await response.json();
  return (data.albums?.items || [])
    .map(mapAlbum)
    .filter(Boolean);
}

function buildQueries(raw) {
  const q = raw.trim().replace(/\s+/g, ' ');
  const queries = [];

  queries.push(`album:"${q}"`);
  queries.push(q);

  const dash = q.split(/\s+-\s+/);
  if (dash.length >= 2) {
    const artist = dash[0].trim();
    const album = dash.slice(1).join(' - ').trim();
    if (artist && album) {
      queries.push(`artist:"${artist}" album:"${album}"`);
      queries.push(`album:"${album}" artist:"${artist}"`);
    }
  }

  const words = q.split(' ').filter((w) => w.length > 2);
  if (words.length > 4) {
    queries.push(`album:"${words.slice(0, 4).join(' ')}"`);
    queries.push(words.slice(0, 5).join(' '));
  }

  return [...new Set(queries)];
}

function mergeResults(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const album of list) {
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

    const albumId = extractAlbumId(trimmed);
    if (albumId) {
      const album = await fetchAlbumById(albumId);
      return NextResponse.json(album ? [album] : []);
    }

    const queries = buildQueries(trimmed);
    const batches = [];

    for (const query of queries) {
      const batch = await searchOnce(query, 20);
      batches.push(batch);
      const merged = mergeResults(batches);
      if (merged.length >= 12) break;
    }

    return NextResponse.json(mergeResults(batches));
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
