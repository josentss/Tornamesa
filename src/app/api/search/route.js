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

    const [localOutcome, remoteOutcome] = await Promise.allSettled([
      searchLocalAlbums(trimmed, RESULT_LIMIT),
      searchSpotifyAlbums(trimmed, RESULT_LIMIT),
    ]);

    const local =
      localOutcome.status === 'fulfilled' && Array.isArray(localOutcome.value)
        ? localOutcome.value
        : [];
    if (localOutcome.status === 'rejected') {
      console.warn('local search:', localOutcome.reason?.message);
    }

    let remote = [];
    let rateLimited = false;
    if (remoteOutcome.status === 'fulfilled') {
      remote = Array.isArray(remoteOutcome.value) ? remoteOutcome.value : [];
    } else {
      const err = remoteOutcome.reason;
      console.error('Spotify search:', err?.message, err?.status);
      if (err?.status === 429) rateLimited = true;
    }

    const extras = [];
    try {
      for (const id of matchCatalogExtras(trimmed)) {
        if (local.some((a) => a.id === id) || remote.some((a) => a.id === id)) {
          continue;
        }
        const album = await getAlbumByIdResolved(id);
        if (album) extras.push(album);
      }
    } catch (e) {
      console.warn('catalog extras:', e.message);
    }

    const merged = dedupeAlbums([...remote, ...extras, ...local]);
    const clean = merged
      .map(({ _score, ...rest }) => rest)
      .slice(0, RESULT_LIMIT);

    if (clean.length === 0 && rateLimited) {
      return NextResponse.json(
        {
          error:
            'Spotify search is rate-limited. Try an album link/id, or search something already in the catalog.',
        },
        { status: 429 }
      );
    }

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
