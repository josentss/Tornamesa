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

const TOTAL = 15;
const SPOTIFY_SLOTS = 7;
const LOCAL_SLOTS = 8;

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

    // Supabase first. Do not touch Spotify when the local catalog can
    // already fill the visible results. Explicit ?remote=1 refreshes search.
    const local = await searchLocalAlbums(trimmed, 40);
    const shouldSearchRemote = searchParams.get('remote') === '1' || local.length < 8;
    const remoteOutcome = shouldSearchRemote
      ? (await Promise.allSettled([searchSpotifyAlbums(trimmed, 10)]))[0]
      : { status: 'fulfilled', value: [] };

    let remote = [];
    let rateLimited = false;
    let spotifyErrMsg = null;

    if (remoteOutcome.status === 'fulfilled') {
      remote = Array.isArray(remoteOutcome.value) ? remoteOutcome.value : [];
    } else {
      const err = remoteOutcome.reason;
      spotifyErrMsg = String(err?.message || err || 'unknown').slice(0, 180);
      console.error('Spotify search:', spotifyErrMsg, err?.status);
      if (err?.status === 429) rateLimited = true;
    }

    const extras = [];
    try {
      for (const id of matchCatalogExtras(trimmed)) {
        if (
          local.some((a) => a.id === id) ||
          remote.some((a) => a.id === id)
        ) {
          continue;
        }
        const album = await getAlbumByIdResolved(id, { allowSpotify: false });
        if (album) extras.push(album);
      }
    } catch (e) {
      console.warn('catalog extras:', e.message);
    }

    const strip = (list) =>
      (list || []).map(({ _score, _noise, ...rest }) => rest);

    const remoteClean = strip(remote);
    const localClean = strip(local);
    const extrasClean = strip(extras);

    const used = new Set();
    const out = [];

    const take = (list, max) => {
      if (max <= 0) return;
      let n = 0;
      for (const a of list) {
        if (!a?.id || used.has(a.id)) continue;
        used.add(a.id);
        out.push(a);
        n += 1;
        if (n >= max) break;
      }
    };

    if (localClean.length === 0 && extrasClean.length === 0) {
      take(remoteClean, TOTAL);
    } else if (remoteClean.length === 0) {
      take(extrasClean, TOTAL);
      take(localClean, TOTAL - out.length);
    } else {
      take(remoteClean, SPOTIFY_SLOTS);
      take(extrasClean, LOCAL_SLOTS);
      take(localClean, TOTAL - out.length);
      take(remoteClean, TOTAL - out.length);
      take(localClean, TOTAL - out.length);
      take(extrasClean, TOTAL - out.length);
    }

    const clean = dedupeAlbums(out).slice(0, TOTAL);

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
    else if (
      remoteClean.length > 0 &&
      (localClean.length > 0 || extrasClean.length > 0)
    )
      res.headers.set('X-Search-Source', 'spotify+local');
    else if (remoteClean.length > 0)
      res.headers.set('X-Search-Source', 'spotify');
    else res.headers.set('X-Search-Source', 'local');

    if (!shouldSearchRemote) res.headers.set('X-Search-Remote-Skipped', 'catalog-sufficient');

    if (spotifyErrMsg) {
      res.headers.set('X-Search-Spotify-Error', spotifyErrMsg);
    }
    res.headers.set('X-Search-Remote-Count', String(remoteClean.length));
    res.headers.set('X-Search-Local-Count', String(localClean.length));
    res.headers.set('X-Search-Result-Count', String(clean.length));

    return res;
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
