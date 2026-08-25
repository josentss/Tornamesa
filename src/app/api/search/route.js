import { NextResponse } from 'next/server';
import { matchCatalogExtras } from '@/lib/catalog-extras';
import {
  extractSpotifyAlbumId,
  getAlbumByIdResolved,
  searchLocalAlbums,
  searchSpotifyAlbums,
  dedupeAlbums,
} from '@/lib/albumResolve';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const RESULT_LIMIT = 15;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: 'Search must be at least 2 characters' },
      { status: 400 }
    );
  }

  const rl = await rateLimit(clientKey(request, 'search'), {
    limit: 45,
    windowMs: 60_000,
    name: 'search',
  });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  try {
    const trimmed = q.trim();

    const directId = extractSpotifyAlbumId(trimmed);
    if (directId) {
      const album = await getAlbumByIdResolved(directId);
      return NextResponse.json(album ? [album] : []);
    }

    let local = [];
    try {
      local = await searchLocalAlbums(trimmed, RESULT_LIMIT);
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
      remote = await searchSpotifyAlbums(trimmed, RESULT_LIMIT);
    } catch (e) {
      console.error('Spotify search:', e.message);
      if (e.status === 429) {
        rateLimited = true;
        if (local.length === 0 && extras.length === 0) {
          return NextResponse.json(
            {
              error:
                'Spotify search is rate-limited. Try an album link/id, or search something already in the catalog.',
            },
            { status: 429 }
          );
        }
      } else if (local.length === 0 && extras.length === 0) {
        return NextResponse.json(
          { error: 'Search temporarily unavailable' },
          { status: 503 }
        );
      }
    }

    const merged = dedupeAlbums([...remote, ...extras, ...local]);
    const clean = merged
      .map(({ _score, ...rest }) => rest)
      .slice(0, RESULT_LIMIT);

    const res = NextResponse.json(clean);
    if (rateLimited) res.headers.set('X-Search-Source', 'local-fallback');
    else if (remote.length > 0)
      res.headers.set('X-Search-Source', 'spotify+local');
    else res.headers.set('X-Search-Source', 'local');
    return res;
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
