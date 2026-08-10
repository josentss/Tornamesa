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
    `&type=album&limit=12`;
  const res = await spotifyFetch(url);
  if (res.status === 429) {
    await sleep(1500);
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

  // Second query only if thin results
  if (byId.size < 4) {
    const second = await searchOnce(`album:${title} artist:${artist}`);
    for (const a of second) byId.set(a.id, a);
  }

  if (byId.size === 0) {
    const byArtist = await searchOnce(`artist:${artist}`);
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

async function resolveRow(row, cache) {
  const cacheKey = `${row.title.toLowerCase()}|${row.artist.toLowerCase()}`;
  if (cache.has(cacheKey)) {
    return { ...row, ...cache.get(cacheKey), cached: true };
  }

  const extra = matchCatalogExtra(row);
  if (extra) {
    const album = await fetchAlbum(extra.id);
    if (album) {
      const mapped = mapAlbum(album);
      const result = {
        status: 'matched',
        albumId: mapped.id,
        albumTitle: mapped.title,
        albumArtist: mapped.artist,
        coverUrl: mapped.coverUrl,
        matchSource: 'catalog_extras',
        score: 100,
      };
      cache.set(cacheKey, result);
      return { ...row, ...result };
    }
  }

  const items = await searchSpotifyFast(row);

  if (!items.length) {
    const result = { status: 'unmatched', score: 0, candidates: [] };
    cache.set(cacheKey, result);
    return { ...row, ...result };
  }

  const ranked = items
    .map((album) => ({ album, score: scoreAlbumMatch(row, album) }))
    .sort((a, b) => b.score - a.score);

  const result = classifyMatch(row, ranked);
  cache.set(cacheKey, result);
  return { ...row, ...result };
}

async function resolveAllRows(rows, cache) {
  const results = [];
  const BATCH = 4;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const part = await Promise.all(chunk.map((row) => resolveRow(row, cache)));
    results.push(...part);
    if (i + BATCH < rows.length) await sleep(40);
  }

  return results;
}

export async function POST(request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const files = body.files;

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Provide files: [{ name, content }]' },
        { status: 400 }
      );
    }

    if (files.length > 1) {
      return NextResponse.json(
        { error: 'Upload 1 month file at a time to avoid timeouts' },
        { status: 400 }
      );
    }

    const matched = [];
    const ambiguous = [];
    const unmatched = [];
    const parseErrors = [];
    const cache = new Map();

    for (const file of files) {
      const name = String(file.name || 'notes.txt');
      const content = String(file.content || '');
      if (content.length > 200_000) {
        parseErrors.push({ file: name, reason: 'file_too_large' });
        continue;
      }

      const parsed = parseNotesFile(content, name);
      parseErrors.push(
        ...parsed.parseErrors.map((e) => ({ ...e, file: name }))
      );

      if (!parsed.year || !parsed.month) {
        parseErrors.push({
          file: name,
          reason: 'filename_must_be_YYYY-MM.txt',
        });
        continue;
      }

      const resolved = await resolveAllRows(parsed.rows, cache);

      for (const entry of resolved) {
        if (entry.status === 'matched') matched.push(entry);
        else if (entry.status === 'ambiguous') ambiguous.push(entry);
        else unmatched.push(entry);
      }
    }

    const matchedSorted = sortByNotesOrder(matched);
    const ambiguousSorted = sortByNotesOrder(ambiguous);
    const unmatchedSorted = sortByNotesOrder(unmatched);

    const totalListens = matchedSorted.reduce(
      (s, r) => s + (r.count || 0),
      0
    );

    return NextResponse.json({
      matched: matchedSorted,
      ambiguous: ambiguousSorted,
      unmatched: unmatchedSorted,
      parseErrors,
      summary: {
        matched: matchedSorted.length,
        ambiguous: ambiguousSorted.length,
        unmatched: unmatchedSorted.length,
        parseErrors: parseErrors.length,
        totalListensIfImported: totalListens,
        rowsParsed:
          matchedSorted.length +
          ambiguousSorted.length +
          unmatchedSorted.length,
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
