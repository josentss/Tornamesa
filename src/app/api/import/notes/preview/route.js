import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spotifyFetch } from '@/lib/spotify';
import {
  parseNotesFile,
  matchCatalogExtra,
  scoreAlbumMatch,
  sortByNotesOrder,
  isTitleExtension,
  normalize,
  coreTitle,
} from '@/lib/notesImport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROWS_PER_CHUNK = 12; // safe under 60s on Hobby

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

function mapAlbum(album) {
  if (!album?.id) return null;
  return {
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name || 'Unknown',
    coverUrl: album.images?.[0]?.url || null,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchOnce(q) {
  const url =
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}` +
    `&type=album&limit=10`;
  const res = await spotifyFetch(url);
  if (res.status === 429) {
    await sleep(1200);
    const res2 = await spotifyFetch(url);
    if (!res2.ok) return [];
    const data2 = await res2.json();
    return (data2.albums?.items || []).filter((a) => a?.id);
  }
  if (!res.ok) return [];
  const data = await res.json();
  return (data.albums?.items || []).filter((a) => a?.id);
}

async function searchSpotifyFast(row) {
  const title = row.title.trim();
  const artist = row.artist.trim();
  const byId = new Map();

  const first = await searchOnce(`${title} ${artist}`);
  for (const a of first) byId.set(a.id, a);

  if (byId.size < 3) {
    const second = await searchOnce(`"${title}" ${artist}`);
    for (const a of second) byId.set(a.id, a);
  }

  if (byId.size === 0) {
    const byArtist = await searchOnce(artist);
    for (const a of byArtist) byId.set(a.id, a);
  }

  return [...byId.values()];
}

async function fetchAlbum(id) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${id}`);
  if (!res.ok) return null;
  return res.json();
}

function classifyMatch(row, ranked) {
  if (!ranked.length) {
    return { status: 'unmatched', score: 0, candidates: [] };
  }

  const best = ranked[0];
  const second = ranked[1];
  const gap = second ? best.score - second.score : 99;
  const mapped = mapAlbum(best.album);
  const candidates = ranked.slice(0, 8).map((r) => ({
    id: r.album.id,
    title: r.album.name,
    artist: r.album.artists?.[0]?.name,
    coverUrl: r.album.images?.[0]?.url || null,
    score: r.score,
  }));

  const extension = isTitleExtension(row.title, best.album.name);
  const exactTitle =
    normalize(row.title) === normalize(best.album.name) ||
    coreTitle(row.title) === coreTitle(best.album.name);

  if (!extension && exactTitle && best.score >= 70 && gap >= 10) {
    return {
      status: 'matched',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: 'spotify_search',
      score: best.score,
      candidates,
    };
  }

  if (!extension && best.score >= 78 && gap >= 15) {
    return {
      status: 'matched',
      albumId: mapped.id,
      albumTitle: mapped.title,
      albumArtist: mapped.artist,
      coverUrl: mapped.coverUrl,
      matchSource: 'spotify_search',
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
        : 'spotify_search_low_confidence',
      score: best.score,
      candidates,
    };
  }

  return { status: 'unmatched', score: best.score, candidates };
}

async function resolveRow(row) {
  const extra = matchCatalogExtra(row);
  if (extra) {
    const album = await fetchAlbum(extra.id);
    if (album) {
      const mapped = mapAlbum(album);
      return {
        ...row,
        status: 'matched',
        albumId: mapped.id,
        albumTitle: mapped.title,
        albumArtist: mapped.artist,
        coverUrl: mapped.coverUrl,
        matchSource: 'catalog_extras',
        score: 100,
      };
    }
  }

  const items = await searchSpotifyFast(row);
  if (!items.length) {
    return { ...row, status: 'unmatched', score: 0, candidates: [] };
  }

  const ranked = items
    .map((album) => ({ album, score: scoreAlbumMatch(row, album) }))
    .sort((a, b) => b.score - a.score);

  return { ...row, ...classifyMatch(row, ranked) };
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
      20,
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

    // sequential within chunk (more stable vs Spotify 429 than heavy parallel)
    const resolved = [];
    for (const row of slice) {
      resolved.push(await resolveRow(row));
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
