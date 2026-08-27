import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { userId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();
    if (authUser.id !== userId) return forbidden();

    const rl = await rateLimit(clientKey(request, 'summary-gen', authUser.id), {
      limit: 10,
      windowMs: 60_000,
      name: 'summary-gen',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'year and month (1-12) are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString();

    const { data: listens, error } = await supabase
      .from('listens')
      .select('album_id, albums(title, artist, duration_ms)')
      .eq('user_id', userId)
      .gte('listened_at', startDate)
      .lt('listened_at', endDate);

    if (error) throw error;

    if (!listens || listens.length === 0) {
      return NextResponse.json(
        { error: 'No listens for this month' },
        { status: 404 }
      );
    }

    let totalMs = 0;
    const albumCounts = {};
    const artistCounts = {};

    listens.forEach((listen) => {
      const album = listen.albums;
      if (!album) return;

      totalMs += album.duration_ms || 0;
      albumCounts[listen.album_id] = (albumCounts[listen.album_id] || 0) + 1;
      artistCounts[album.artist] = (artistCounts[album.artist] || 0) + 1;
    });

    const topAlbumId = Object.keys(albumCounts).reduce((a, b) =>
      albumCounts[a] > albumCounts[b] ? a : b
    );
    const topArtist = Object.keys(artistCounts).reduce((a, b) =>
      artistCounts[a] > artistCounts[b] ? a : b
    );

    const { data: summary, error: summaryError } = await supabase
      .from('monthly_summaries')
      .upsert(
        {
          user_id: userId,
          year,
          month,
          total_minutes: Math.round(totalMs / 1000 / 60),
          total_listens: listens.length,
          most_listened_album_id: topAlbumId,
          top_artist: topArtist,
        },
        { onConflict: 'user_id,year,month' }
      )
      .select();

    if (summaryError) throw summaryError;

    return NextResponse.json({
      success: true,
      message: `Summary generated for ${month}/${year}`,
      summary: summary?.[0] || null,
    });
  } catch (error) {
    console.error('generate summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
