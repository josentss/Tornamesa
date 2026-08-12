import { NextResponse } from 'next/server';
import { matchCatalogExtras } from '@/lib/catalog-extras';
import {
  extractSpotifyAlbumId,
  getAlbumByIdResolved,
  searchLocalAlbums,
  searchSpotifyAlbums,
  dedupeAlbums,
} from '@/lib/albumResolve';

export const dynamic = 'force-dynamic';

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

    const directId = extractSpotifyAlbumId(trimmed);
    if (directId) {
      const album = await getAlbumByIdResolved(directId);
      return NextResponse.json(album ? [album] : []);
    }

    let local = [];
    try {
      local = await searchLocalAlbums(trimmed, 12);
    } catch (e) {
      console.warn('local search:', e.message);
    }

    const extras = [];
    try {
      for (const id of matchCatalogExtras(trimmed)) {
        if (local.some((a) => a.id === id)) continue;
        const album = await getAlbumByIdResolved(id);
        if (album) extras.push(album);
      }
    } catch (e) {
      console.warn('catalog extras:', e.message);
    }

    let remote = [];
    let rateLimited = false;

    try {
      remote = await searchSpotifyAlbums(trimmed);
    } catch (e) {
      console.error('Spotify search:', e.message);
      if (e.status === 429) {
        rateLimited = true;
        if (local.length === 0 && extras.length === 0) {
          return NextResponse.json(
            {
              error:
                'Spotify search is rate-limited. Try an album link/id, or search something already in the catalog.',
              results: [],
            },
            { status: 429 }
          );
        }
      } else if (local.length === 0 && extras.length === 0) {
        return NextResponse.json(
          { error: 'Search temporarily unavailable', message: e.message },
          { status: 503 }
        );
      }
    }

    const merged = dedupeAlbums([...remote, ...extras, ...local]);

    const clean = merged
      .map(({ _score, ...rest }) => rest)
      .slice(0, 15);

    const res = NextResponse.json(clean);
    if (rateLimited) res.headers.set('X-Search-Source', 'local-fallback');
    else if (remote.length > 0) res.headers.set('X-Search-Source', 'spotify+local');
    else res.headers.set('X-Search-Source', 'local');
    return res;
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable', message: error.message },
      { status: 503 }
    );
  }
}
