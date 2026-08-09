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

async function searchSpotify(title, artist) {
  const q = `${title} ${artist}`;
  const url =
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=10`;
  const res = await spotifyFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.albums?.items || []).filter((a) => a?.id);
}

async function fetchAlbum(id) {
  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${id}`);
  if (!res.ok) return null;
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
    if (files.length > 24) {
      return NextResponse.json({ error: 'Too many files' }, { status: 400 });
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
      }

      for (const row of parsed.rows) {
        if (!row.year || !row.month) continue;

        const cacheKey = `${row.title.toLowerCase()}|${row.artist.toLowerCase()}`;
        if (cache.has(cacheKey)) {
          const prev = cache.get(cacheKey);
          const entry = { ...row, ...prev, cached: true };
          if (prev.status === 'matched') matched.push(entry);
          else if (prev.status === 'ambiguous') ambiguous.push(entry);
          else unmatched.push(entry);
          continue;
        }

        // catalog extras
        const extra = matchCatalogExtra(row);
        if (extra) {
          const album = await fetchAlbum(extra.id);
          await sleep(60);
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
            matched.push({ ...row, ...result });
            continue;
          }
        }

        const items = await searchSpotify(row.title, row.artist);
        await sleep(100);

        if (!items.length) {
          const result = { status: 'unmatched', score: 0 };
          cache.set(cacheKey, result);
          unmatched.push({ ...row, ...result });
          continue;
        }

        const ranked = items
          .map((album) => ({ album, score: scoreAlbumMatch(row, album) }))
          .sort((a, b) => b.score - a.score);

        const best = ranked[0];
        const second = ranked[1];

        if (best.score >= 60 && (!second || best.score - second.score >= 10)) {
          const mapped = mapAlbum(best.album);
          const result = {
            status: 'matched',
            albumId: mapped.id,
            albumTitle: mapped.title,
            albumArtist: mapped.artist,
            coverUrl: mapped.coverUrl,
            matchSource: 'spotify_search',
            score: best.score,
          };
          cache.set(cacheKey, result);
          matched.push({ ...row, ...result });
          continue;
        }

        if (best.score >= 40) {
          const mapped = mapAlbum(best.album);
          const result = {
            status: 'ambiguous',
            albumId: mapped.id,
            albumTitle: mapped.title,
            albumArtist: mapped.artist,
            coverUrl: mapped.coverUrl,
            matchSource: 'spotify_search_low_confidence',
            score: best.score,
            candidates: ranked.slice(0, 5).map((r) => ({
              id: r.album.id,
              title: r.album.name,
              artist: r.album.artists?.[0]?.name,
              coverUrl: r.album.images?.[0]?.url || null,
              score: r.score,
            })),
          };
          cache.set(cacheKey, result);
          ambiguous.push({ ...row, ...result });
          continue;
        }

        const result = {
          status: 'unmatched',
          score: best.score,
          candidates: ranked.slice(0, 3).map((r) => ({
            id: r.album.id,
            title: r.album.name,
            artist: r.album.artists?.[0]?.name,
            score: r.score,
          })),
        };
        cache.set(cacheKey, result);
        unmatched.push({ ...row, ...result });
      }
    }

    const totalListens = matched.reduce((s, r) => s + (r.count || 0), 0);

    return NextResponse.json({
      matched,
      ambiguous,
      unmatched,
      parseErrors,
      summary: {
        matched: matched.length,
        ambiguous: ambiguous.length,
        unmatched: unmatched.length,
        parseErrors: parseErrors.length,
        totalListensIfImported: totalListens,
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
