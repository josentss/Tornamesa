import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { spotifySharedQuotaConfigured, reserveSpotifyImportSearch } from '@/lib/spotifyQuota';
import { createClient } from '@supabase/supabase-js';
import {
  parseNotesFile,
  matchCatalogExtra,
  scoreAlbumMatch,
  sortByNotesOrder,
  isTitleExtension,
  titlesMatchLoose,
  SUSPICIOUS_ALBUM_RE,
} from '@/lib/notesImport';
import {
  extractSpotifyAlbumId,
  getAlbumByIdResolved,
  searchLocalByTitleArtist,
  searchSpotifyAlbums,
} from '@/lib/albumResolve';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROWS_PER_CHUNK = 10;
// Even with remote mode selected, the same file may only request 3 Spotify searches per hour.
const MAX_REMOTE_SEARCHES_PER_CHUNK = 2;

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

async function reserveImportRemote(ctx) {
  if (!ctx.remoteEnabled || ctx.skipSpotifySearch) return false;
  if (ctx.remoteAttempts >= MAX_REMOTE_SEARCHES_PER_CHUNK) {
    ctx.remoteBudgetExhausted = true;
    return false;
  }
  // The Redis-backed limiter is global across preview chunks and Vercel
  // instances. Remote mode is disabled if Redis is unavailable.
  const permit = await reserveSpotifyImportSearch(ctx.userId, ctx.fileHash);
  if (!permit.allowed) {
    if (permit.unavailable) ctx.remoteUnavailable = true;
    else ctx.remoteBudgetExhausted = true;
    return false;
  }
  ctx.remoteAttempts += 1;
  return true;
}

function toScoreable(album) {
  if (!album) return null;
  if (album.name && album.artists) return album;
  const id = album.id || album.spotify_id;
  if (!id) return null;
  return {
    id,
    name: album.title || album.name || 'Unknown',
    artists: [{ name: album.artist || 'Unknown' }],
    images: album.coverUrl
      ? [{ url: album.coverUrl }]
      : album.cover_url
        ? [{ url: album.cover_url }]
        : [],
    album_type: 'album',
  };
}

function mapOut(album) {
  const s = toScoreable(album);
  if (!s?.id) return null;
  return {
    id: s.id,
    title: s.name,
    artist: s.artists?.[0]?.name || 'Unknown',
    coverUrl: s.images?.[0]?.url || null,
  };
}

function classify(row, ranked, matchSourceBase) {
  if (!ranked.length) {
    return { status: 'unmatched', score: 0, candidates: [] };
  }

  const best = ranked[0];
  const second = ranked[1];
  const gap = second ? best.score - second.score : 99;
  const mapped = mapOut(best.album);
  const candidates = ranked.slice(0, 8).map((r) => {
    const m = mapOut(r.album);
    return {
      id: m?.id,
      title: m?.title,
      artist: m?.artist,
      coverUrl: m?.coverUrl,
      score: r.score,
    };
  });

  const extension = isTitleExtension(row.title, mapped.title);
  const suspicious = SUSPICIOUS_ALBUM_RE.test(
    `${mapped.title} ${mapped.artist}`
  );
  const exactEnough = titlesMatchLoose(row.title, mapped.title);

  if (extension || suspicious || !exactEnough) {
    return {
      status: 'ambiguous',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: suspicious
        ? 'suspicious_edition_review'
        : extension
          ? 'title_extension_review'
          : 'title_mismatch_review',
      score: best.score,
      candidates,
    };
  }

  if (exactEnough && best.score >= 70 && gap >= 6) {
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

  if (best.score >= 20 || candidates.length > 0) {
    return {
      status: 'ambiguous',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: `${matchSourceBase}_review`,
      score: best.score,
      candidates,
    };
  }

  return { status: 'unmatched', score: best.score, candidates };
}

function isSuspiciousAlbum(album) {
  const m = mapOut(album);
  if (!m) return true;
  return SUSPICIOUS_ALBUM_RE.test(`${m.title} ${m.artist}`);
}

function rank(row, albums, source) {
  const ranked = albums
    .map((album) => {
      const scoreable = toScoreable(album);
      if (!scoreable) return null;
      let score = scoreAlbumMatch(row, scoreable);
      if (isSuspiciousAlbum(scoreable)) score = Math.min(score, 25);
      return { album: scoreable, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const sa = isSuspiciousAlbum(a.album) ? 1 : 0;
      const sb = isSuspiciousAlbum(b.album) ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return b.score - a.score;
    });

  return classify(row, ranked, source);
}

function candidatesAllBad(result) {
  const list = result?.candidates || [];
  if (!list.length) return true;
  return list.every((c) =>
    SUSPICIOUS_ALBUM_RE.test(`${c.title || ''} ${c.artist || ''}`)
  );
}

async function resolveRow(row, ctx) {
  const directId =
    extractSpotifyAlbumId(row.title) ||
    extractSpotifyAlbumId(row.rest || '') ||
    extractSpotifyAlbumId(row.raw || '');

  if (directId) {
    const album = await getAlbumByIdResolved(directId, { allowSpotify: false });
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
    const album = await getAlbumByIdResolved(extra.id, { allowSpotify: false });
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

  const local = await searchLocalByTitleArtist(row.title, row.artist, 15);
  if (local.length) {
    const result = rank(row, local, 'local_db');
    if (result.status === 'matched') {
      return { ...row, ...result };
    }
    if (
      result.status === 'ambiguous' &&
      !candidatesAllBad(result) &&
      (ctx.skipSpotifySearch || result.score >= 55)
    ) {
      return { ...row, ...result };
    }
  }

  if (ctx.skipSpotifySearch || !ctx.remoteEnabled || !(await reserveImportRemote(ctx))) {
    if (local.length) return { ...row, ...rank(row, local, 'local_db') };
    return {
      ...row,
      status: 'unmatched',
      score: 0,
      candidates: [],
      matchSource: 'skipped_rate_limit',
    };
  }

  try {
    // Exactly one remote search for an unresolved entry. No hidden retries,
    // secondary spellings or bursts of 3 queries per single album.
    const q = `"${row.title}" artist:${row.artist}`;
    const remote = await searchSpotifyAlbums(q, 10);
    if (!remote.length) {
      if (local.length) return { ...row, ...rank(row, local, 'local_db') };
      return { ...row, status: 'unmatched', score: 0, candidates: [] };
    }

    return { ...row, ...rank(row, [...local, ...remote], 'spotify_search') };

  } catch (e) {
    if (e.status === 429) {
      ctx.skipSpotifySearch = true;
      ctx.rateLimited = true;
      if (local.length) return { ...row, ...rank(row, local, 'local_db') };
      return {
        ...row,
        status: 'unmatched',
        score: 0,
        candidates: [],
        matchSource: 'rate_limited',
      };
    }
    console.error('import resolve search:', e.message);
    if (local.length) return { ...row, ...rank(row, local, 'local_db') };
    return { ...row, status: 'unmatched', score: 0, candidates: [] };
  }
}

export async function POST(request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit(clientKey(request, 'import-preview', user.id), {
      limit: 20,
      windowMs: 60_000,
      name: 'import-preview',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

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
    const remoteRequested = body.spotifyMode === 'limited';
    const remoteEnabled = remoteRequested && spotifySharedQuotaConfigured();
    const fileHash = createHash('sha256')
      .update(name).update('\0').update(content).digest('hex');
    const parseErrors =
      offset === 0
        ? parsed.parseErrors.map((e) => ({ ...e, file: name }))
        : [];

    if (!parsed.year || !Number.isInteger(parsed.month) || parsed.month < 1 || parsed.month > 12) {
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

    const ctx = {
      userId: user.id,
      fileHash,
      remoteEnabled,
      skipSpotifySearch: false,
      rateLimited: false,
      remoteAttempts: 0,
      remoteBudgetExhausted: false,
      remoteUnavailable: false,
    };
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
      remoteSearchUsed: ctx.remoteAttempts,
      remoteBudgetExhausted: ctx.remoteBudgetExhausted,
      remoteDisabled: (remoteRequested && !remoteEnabled) || ctx.remoteUnavailable,
      spotifyMode: remoteEnabled ? 'limited' : 'local',
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
