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
import { reserveAlbumSearch, confirmAlbumSearchSuccess } from '@/lib/searchFreshness';

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

    // Global local catalog first, but never infer freshness from how many
    // albums it contains. Any query with expired freshness can refresh Spotify.
    const local = await searchLocalAlbums(trimmed, 40);
    const decision = await reserveAlbumSearch(trimmed, {
      force: searchParams.get('remote') === '1',
    });

    let remote = [];
    let rateLimited = false;
    let spotifyErrMsg = null;
    let searchFreshness = decision.reason || 'local';

    if (decision.fetchRemote) {
      try {
        // A successful remote query is fresh only after its search results
        // have been persisted to the catalog, not merely shown in this reply.
        remote = await searchSpotifyAlbums(trimmed, 10, { strictPersistence: true });
        await confirmAlbumSearchSuccess(decision);
        searchFreshness = 'updated';
      } catch (err) {
        spotifyErrMsg = String(err?.message || err || 'unknown').slice(0, 180);
        console.warn('Spotify search:', spotifyErrMsg, err?.status);
        if (err?.status === 429) rateLimited = true;
        searchFreshness = 'spotify-unavailable';
      }
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
      return NextResponse.json({
        error: 'Spotify temporarily limited. Saved albums are still searchable; try again later.',
      }, { status: 429 });
    }
    if (clean.length === 0 && spotifyErrMsg) {
      return NextResponse.json({
        error: 'Spotify search is temporarily unavailable. Please try later.',
      }, { status: 503 });
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

    res.headers.set('X-Search-Freshness', searchFreshness);
    if (!decision.fetchRemote) res.headers.set('X-Search-Remote-Skipped', searchFreshness);

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
