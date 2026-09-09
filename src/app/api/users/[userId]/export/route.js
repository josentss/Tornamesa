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
  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json(
      { error: 'format must be json or csv' },
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
      const { data: reviews } = await supabase
        .from('reviews')
        .select('album_id, rating, review')
        .eq('user_id', userId)
        .in('album_id', chunk);
      (reviews || []).forEach((r) => {
        reviewMap[r.album_id] = r;
      });
    }

    const flat = rows.map((r) => {
      const albumId = r.albums?.spotify_id || r.album_id || '';
      const rev = reviewMap[albumId];
      return {
        listen_id: r.id,
        listened_at: r.listened_at,
        album_id: albumId,
        title: r.albums?.title || '',
        artist: r.albums?.artist || '',
        rating: rev?.rating ?? r.rating ?? null,
        review: rev?.review ?? r.review ?? null,
      };
    });

    if (format === 'csv') {
      const header = [
        'listen_id',
        'listened_at',
        'album_id',
        'title',
        'artist',
        'rating',
        'review',
      ];
      const lines = [header.join(',')];
      for (const row of flat) {
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
      if (truncated) {
        lines.push('# truncated at max rows');
      }

      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tornamesa-listens.csv"`,
          'Cache-Control': 'no-store',
          'X-Export-Count': String(flat.length),
          'X-Export-Truncated': truncated ? '1' : '0',
        },
      });
    }

    return NextResponse.json(
      {
        exported_at: new Date().toISOString(),
        count: flat.length,
        truncated,
        listens: flat,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="tornamesa-listens.json"`,
        },
      }
    );
  } catch (e) {
    console.error('export:', e);
    return NextResponse.json(
      { error: e.message || 'Export failed' },
      { status: 500 }
    );
  }
}
