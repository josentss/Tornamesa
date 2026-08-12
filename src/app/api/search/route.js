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

    const local = await searchLocalAlbums(trimmed, 12);

    const extras = [];
    for (const id of matchCatalogExtras(trimmed)) {
      if (local.some((a) => a.id === id)) continue;
      const album = await getAlbumByIdResolved(id);
      if (album) extras.push(album);
    }

    const strongLocal = local.filter((a) => (a._score || 0) >= 50);

    let remote = [];
    let spotifyFailed = false;

    const skipSpotify = strongLocal.length >= 5;

    if (!skipSpotify) {
      try {
        remote = await searchSpotifyAlbums(trimmed);
      } catch (e) {
        spotifyFailed = true;
        if (e.status === 429 && local.length === 0 && extras.length === 0) {
          return NextResponse.json(
            {
              error:
                'Spotify search is rate-limited. Try an album link or search something already logged.',
              results: [],
            },
            { status: 429 }
          );
        }
        if (local.length === 0 && extras.length === 0) {
          return NextResponse.json(
            { error: 'Search temporarily unavailable', message: e.message },
            { status: 503 }
          );
        }
      }
    }

    const merged = dedupeAlbums([
      ...remote,
      ...strongLocal,
      ...extras,
      ...local.filter((a) => (a._score || 0) < 50),
    ]);

    const clean = merged.map(({ _score, ...rest }) => rest).slice(0, 15);

    if (clean.length === 0 && spotifyFailed) {
      return NextResponse.json(
        { error: 'Search temporarily unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json(clean);
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable', message: error.message },
      { status: 503 }
    );
  }
}
