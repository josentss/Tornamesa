import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_ROWS = 20_000;
const PAGE = 1000;

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toFlat(rows, reviewMap) {
  return rows.map((r) => {
    const albumId = r.albums?.spotify_id || r.album_id || '';
    const rev = reviewMap[albumId];
    return {
      listen_id: r.id,
      listened_at: r.listened_at,
      album_id: albumId,
      title: r.albums?.title || '',
      artist: r.albums?.artist || '',
      rating: rev?.rating ?? r.rating ?? null,
      review: rev?.review_text ?? r.review ?? null,
    };
  });
}

function toSummary(flat) {
  const map = new Map();
  for (const row of flat) {
    const key = row.album_id || `${row.title}|${row.artist}`;
    let cur = map.get(key);
    if (!cur) {
      cur = {
        album_id: row.album_id,
        title: row.title,
        artist: row.artist,
        play_count: 0,
        first_listened: row.listened_at,
        last_listened: row.listened_at,
        rating: row.rating,
        review: row.review,
      };
      map.set(key, cur);
    }
    cur.play_count += 1;
    if (row.listened_at < cur.first_listened) {
      cur.first_listened = row.listened_at;
    }
    if (row.listened_at > cur.last_listened) {
      cur.last_listened = row.listened_at;
    }
    if (cur.rating == null && row.rating != null) cur.rating = row.rating;
    if (!cur.review && row.review) cur.review = row.review;
  }
  return [...map.values()].sort((a, b) =>
    (b.last_listened || '').localeCompare(a.last_listened || '')
  );
}

export async function GET(request, { params }) {
  const { userId } = params;

  const authUser = await getRequestUser(request);
  if (!authUser) return unauthorized();
  if (authUser.id !== userId) return forbidden();

  const rl = await rateLimit(clientKey(request, 'export', authUser.id), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    name: 'export',
  });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const mode = (searchParams.get('mode') || 'detailed').toLowerCase();

  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json(
      { error: 'format must be json or csv' },
      { status: 400 }
    );
  }
  if (mode !== 'detailed' && mode !== 'summary') {
    return NextResponse.json(
      { error: 'mode must be detailed or summary' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  try {
    const rows = [];
    let offset = 0;

    while (rows.length < MAX_ROWS) {
      const { data, error } = await supabase
        .from('listens')
        .select(
          `
          id,
          listened_at,
          rating,
          review,
          album_id,
          albums (
            spotify_id,
            title,
            artist
          )
        `
        )
        .eq('user_id', userId)
        .order('listened_at', { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (error) throw error;
      if (!data?.length) break;

      rows.push(...data);
      offset += PAGE;
      if (data.length < PAGE) break;
    }

    const truncated = rows.length >= MAX_ROWS;

    const albumIds = [
      ...new Set(
        rows.map((r) => r.albums?.spotify_id || r.album_id).filter(Boolean)
      ),
    ];

    const reviewMap = {};
    for (let i = 0; i < albumIds.length; i += 200) {
      const chunk = albumIds.slice(i, i + 200);
      const { data: reviews, error: revErr } = await supabase
        .from('reviews')
        .select('album_id, rating, review_text')
        .eq('user_id', userId)
        .in('album_id', chunk);

      if (revErr) {
        console.warn('export reviews:', revErr.message);
        continue;
      }
      (reviews || []).forEach((r) => {
        if (r.album_id) reviewMap[r.album_id] = r;
      });
    }

    const detailed = toFlat(rows, reviewMap);
    const payloadRows =
      mode === 'summary' ? toSummary(detailed) : detailed;

    if (format === 'csv') {
      let header;
      let lines;

      if (mode === 'summary') {
        header = [
          'album_id',
          'title',
          'artist',
          'play_count',
          'first_listened',
          'last_listened',
          'rating',
          'review',
        ];
        lines = [header.join(',')];
        for (const row of payloadRows) {
          lines.push(
            [
              row.album_id,
              csvEscape(row.title),
              csvEscape(row.artist),
              row.play_count,
              row.first_listened,
              row.last_listened,
              row.rating ?? '',
              csvEscape(row.review),
            ].join(',')
          );
        }
      } else {
        header = [
          'listen_id',
          'listened_at',
          'album_id',
          'title',
          'artist',
          'rating',
          'review',
        ];
        lines = [header.join(',')];
        for (const row of payloadRows) {
          lines.push(
            [
              row.listen_id,
              row.listened_at,
              row.album_id,
              csvEscape(row.title),
              csvEscape(row.artist),
              row.rating ?? '',
              csvEscape(row.review),
            ].join(',')
          );
        }
      }

      if (truncated) lines.push('# truncated at max rows');

      const filename =
        mode === 'summary'
          ? 'tornamesa-listens-summary.csv'
          : 'tornamesa-listens.csv';

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          'X-Export-Count': String(payloadRows.length),
          'X-Export-Mode': mode,
          'X-Export-Truncated': truncated ? '1' : '0',
        },
      });
    }

    const body =
      mode === 'summary'
        ? {
            exported_at: new Date().toISOString(),
            mode: 'summary',
            count: payloadRows.length,
            listen_events: detailed.length,
            truncated,
            albums: payloadRows,
          }
        : {
            exported_at: new Date().toISOString(),
            mode: 'detailed',
            count: payloadRows.length,
            truncated,
            listens: payloadRows,
          };

    const filename =
      mode === 'summary'
        ? 'tornamesa-listens-summary.json'
        : 'tornamesa-listens.json';

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Mode': mode,
      },
    });
  } catch (e) {
    console.error('export:', e);
    return NextResponse.json(
      { error: e.message || 'Export failed' },
      { status: 500 }
    );
  }
}
