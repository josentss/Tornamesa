import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  parseNotesFile,
  matchCatalogExtra,
  scoreAlbumMatch,
  sortByNotesOrder,
  isTitleExtension,
  normalize,
  coreTitle,
} from '@/lib/notesImport';
import {
  extractSpotifyAlbumId,
  getAlbumByIdResolved,
  searchLocalAlbums,
  searchSpotifyAlbums,
  upsertAlbumFromSpotify,
  fetchSpotifyAlbumById,
} from '@/lib/albumResolve';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROWS_PER_CHUNK = 10;

async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toScoreable(album) {
  if (!album) return null;

  if (album.name && album.artists) return album;

  if (album.id || album.spotify_id) {
    return {
      id: album.id || album.spotify_id,
      name: album.title || album.name,
      artists: [{ name: album.artist || 'Unknown' }],
      images: album.coverUrl
        ? [{ url: album.coverUrl }]
        : album.cover_url
          ? [{ url: album.cover_url }]
          : [],
      album_type: 'album',
    };
  }
  return null;
}

function mapResolved(album) {
  const s = toScoreable(album);
  if (!s?.id) return null;
  return {
    id: s.id,
    title: s.name,
    artist: s.artists?.[0]?.name || 'Unknown',
    coverUrl: s.images?.[0]?.url || null,
  };
}

function classify(row, ranked, matchSourceBase = 'resolve') {
  if (!ranked.length) {
    return { status: 'unmatched', score: 0, candidates: [] };
  }

  const best = ranked[0];
  const second = ranked[1];
  const gap = second ? best.score - second.score : 99;
  const mapped = mapResolved(best.album);
  const candidates = ranked.slice(0, 8).map((r) => {
    const m = mapResolved(r.album);
    return {
      id: m?.id,
      title: m?.title,
      artist: m?.artist,
      coverUrl: m?.coverUrl,
      score: r.score,
    };
  });

  const extension = isTitleExtension(row.title, mapped.title);
  const exactTitle =
    normalize(row.title) === normalize(mapped.title) ||
    coreTitle(row.title) === coreTitle(mapped.title);

  if (!extension && exactTitle && best.score >= 70 && gap >= 8) {
    return {
      status: 'matched',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: matchSourceBase,
      score: best.score,
      candidates,
    };
  }

  if (!extension && best.score >= 78 && gap >= 12) {
    return {
      status: 'matched',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: matchSourceBase,
      score: best.score,
      candidates,
    };
  }

  if (best.score >= 25 || candidates.length > 0) {
    return {
      status: 'ambiguous',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: extension
        ? 'title_extension_review'
        : `${matchSourceBase}_review`,
      score: best.score,
      candidates,
    };
  }

  return { status: 'unmatched', score: best.score, candidates };
}

function rankAgainstRow(row, albums, matchSource) {
  const ranked = albums
    .map((album) => {
      const scoreable = toScoreable(album);
      if (!scoreable) return null;
      return {
        album: scoreable,
        score: scoreAlbumMatch(row, scoreable),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return classify(row, ranked, matchSource);
}

async function resolveRow(row, ctx) {
  const directId =
    extractSpotifyAlbumId(row.title) ||
    extractSpotifyAlbumId(row.rest || '') ||
    extractSpotifyAlbumId(row.raw || '');

  if (directId) {
    const album = await getAlbumByIdResolved(directId);
    if (album) {
      return {
        ...row,
        status: 'matched',
        albumId: album.id,
        albumTitle: album.title,
        albumArtist: album.artist,
        coverUrl: album.coverUrl,
        matchSource: 'spotify_id',
        score: 100,
      };
    }
  }

  const extra = matchCatalogExtra(row);
  if (extra?.id) {
    const album = await getAlbumByIdResolved(extra.id);
    if (album) {
      return {
        ...row,
        status: 'matched',
        albumId: album.id,
        albumTitle: album.title,
        albumArtist: album.artist,
        coverUrl: album.coverUrl,
        matchSource: 'catalog_extras',
        score: 100,
      };
    }
  }

  const local = await searchLocalAlbums(
    `${row.title} ${row.artist}`.trim(),
    15
  );
  if (local.length) {
    const result = rankAgainstRow(row, local, 'local_db');
    if (result.status === 'matched' || result.status === 'ambiguous') {
      return { ...row, ...result };
    }
  }

  if (ctx.skipSpotifySearch) {
    return {
      ...row,
      status: 'unmatched',
      score: 0,
      candidates: [],
      matchSource: 'skipped_rate_limit',
    };
  }

  try {
    const remote = await searchSpotifyAlbums(
      `${row.title} ${row.artist}`.trim()
    );
    await sleep(120);

    if (!remote.length) {
      return { ...row, status: 'unmatched', score: 0, candidates: [] };
    }

    const scoreable = remote.map((a) =>
      toScoreable(a)
    );
    return { ...row, ...rankAgainstRow(row, scoreable, 'spotify_search') };
  } catch (e) {
    if (e.status === 429) {
      ctx.skipSpotifySearch = true;
      ctx.rateLimited = true;
      // fall back: if local had weak candidates, already returned above
      return {
        ...row,
        status: 'unmatched',
        score: 0,
        candidates: [],
        matchSource: 'rate_limited',
      };
    }
    console.error('import resolve search:', e.message);
    return { ...row, status: 'unmatched', score: 0, candidates: [] };
  }
}

export async function POST(request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const files = body.files;
    const offset = Math.max(0, Number(body.offset) || 0);
    const limit = Math.min(
      15,
      Math.max(1, Number(body.limit) || ROWS_PER_CHUNK)
    );

    if (!Array.isArray(files) || files.length !== 1) {
      return NextResponse.json(
        { error: 'Send exactly 1 file: [{ name, content }]' },
        { status: 400 }
      );
    }

    const file = files[0];
    const name = String(file.name || 'notes.txt');
    const content = String(file.content || '');

    if (content.length > 200_000) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const parsed = parseNotesFile(content, name);
    const parseErrors =
      offset === 0
        ? parsed.parseErrors.map((e) => ({ ...e, file: name }))
        : [];

    if (!parsed.year || !parsed.month) {
      return NextResponse.json(
        {
          error: 'filename_must_be_YYYY-MM.txt',
          parseErrors: [
            { file: name, reason: 'filename_must_be_YYYY-MM.txt' },
          ],
        },
        { status: 400 }
      );
    }

    const totalRows = parsed.rows.length;
    const slice = parsed.rows.slice(offset, offset + limit);

    const ctx = { skipSpotifySearch: false, rateLimited: false };
    const resolved = [];

    for (const row of slice) {
      resolved.push(await resolveRow(row, ctx));
    }

    const matched = [];
    const ambiguous = [];
    const unmatched = [];
    for (const entry of resolved) {
      if (entry.status === 'matched') matched.push(entry);
      else if (entry.status === 'ambiguous') ambiguous.push(entry);
      else unmatched.push(entry);
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= totalRows;

    return NextResponse.json({
      matched: sortByNotesOrder(matched),
      ambiguous: sortByNotesOrder(ambiguous),
      unmatched: sortByNotesOrder(unmatched),
      parseErrors,
      rateLimited: ctx.rateLimited,
      chunk: {
        offset,
        limit,
        processed: slice.length,
        nextOffset,
        totalRows,
        done,
      },
      summary: {
        matched: matched.length,
        ambiguous: ambiguous.length,
        unmatched: unmatched.length,
        parseErrors: parseErrors.length,
        totalListensIfImported: matched.reduce(
          (s, r) => s + (r.count || 0),
          0
        ),
        rowsParsed: resolved.length,
      },
    });
  } catch (error) {
    console.error('import preview:', error);
    return NextResponse.json(
      { error: error.message || 'Preview failed' },
      { status: 500 }
    );
  }
}
