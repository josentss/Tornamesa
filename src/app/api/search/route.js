import { NextResponse } from 'next/server';
import { matchCatalogExtras } from '@/lib/catalog-extras';
import {
  extractSpotifyAlbumId,
  getAlbumByIdResolved,
  searchLocalAlbums,
  searchSpotifyAlbums,
} from '@/lib/albumResolve';

export const dynamic = 'force-dynamic';

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const a of list) {
    if (!a?.id || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
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
    const results = [];

    const directId = extractSpotifyAlbumId(trimmed);
    if (directId) {
      const album = await getAlbumByIdResolved(directId);
      return NextResponse.json(album ? [album] : []);
    }

    const local = await searchLocalAlbums(trimmed, 15);
    results.push(...local);

    const extraIds = matchCatalogExtras(trimmed);
    for (const id of extraIds) {
      if (results.some((a) => a.id === id)) continue;
      const album = await getAlbumByIdResolved(id);
      if (album) results.push(album);
    }

    if (results.length >= 6) {
      return NextResponse.json(dedupeById(results).slice(0, 15));
    }

    try {
      const remote = await searchSpotifyAlbums(trimmed);
      results.push(...remote);
    } catch (e) {
      if (e.status === 429) {
        if (results.length === 0) {
          return NextResponse.json(
            {
              error:
                'Spotify search is rate-limited. Try an album link or search something already logged.',
              results: [],
            },
            { status: 429 }
          );
        }
        return NextResponse.json(dedupeById(results).slice(0, 15));
      }
      console.error('Spotify search:', e.message);
      if (results.length === 0) {
        return NextResponse.json(
          { error: 'Search temporarily unavailable', message: e.message },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(dedupeById(results).slice(0, 15));
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable', message: error.message },
      { status: 503 }
    );
  }
}
