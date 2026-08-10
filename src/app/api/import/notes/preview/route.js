import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spotifyFetch } from '@/lib/spotify';
import {
  parseNotesFile,
  matchCatalogExtra,
  scoreAlbumMatch,
} from '@/lib/notesImport';

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

async function searchSpotify(title, artist) {
  const q = `${title} ${artist}`.trim();
  const params = new URLSearchParams({
    q,
    type: 'album',
    limit: '10',
  });
  const url = `https://api.spotify.com/v1/search?${params.toString()}`;
  const res = await spotifyFetch(url);

  if (res.status === 429) {
    await sleep(1500);
    const res2 = await spotifyFetch(url);
    if (!res2.ok) return [];
    const data2 = await res2.json();
    return (data2.albums?.items || []).filter((a) => a?.id);
  }

  if (!res.ok) {
    console.error('import search fail', res.status);
    return [];
  }

  const data = await res.json();
  return (data.albums?.items || []).filter((a) => a?.id);
}

async function fetchAlbum(id) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${id}`);
  if (!res.ok) return null;
  return res.json();
}

function classify(row, items) {
  if (!items.length) {
    return { status: 'unmatched', score: 0, candidates: [] };
  }

  const ranked = items
    .map((album) => ({ album, score: scoreAlbumMatch(row, album) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const gap = second ? best.score - second.score : 99;
  const mapped = mapAlbum(best.album);
  const candidates = ranked.slice(0, 6).map((r) => ({
    id: r.album.id,
    title: r.album.name,
    artist: r.album.artists?.[0]?.name,
    coverUrl: r.album.images?.[0]?.url || null,
    score: r.score,
  }));

  if (best.score >= 60 && gap >= 8) {
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

  // Hay resultados de Spotify → review (no skip)
  return {
    status: 'ambiguous',
    albumId: mapped.id,
    albumTitle: mapped.title,
    albumArtist: mapped.artist,
    coverUrl: mapped.coverUrl,
    matchSource: 'spotify_search_review',
    score: best.score,
    candidates,
  };
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

  const items = await searchSpotify(row.title, row.artist);
  await sleep(40);
  return { ...row, ...classify(row, items) };
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
        { error: 'Send exactly 1 month file per request' },
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
      matched,
      ambiguous,
      unmatched,
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
