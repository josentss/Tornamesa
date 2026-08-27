import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { userId } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50)
  );
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  const authUser = await getRequestUser(request);
  if (!authUser) return unauthorized();
  if (authUser.id !== userId) return forbidden();

  const supabase = createSupabaseServer();

  try {
    const { data: history, error } = await supabase
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
          artist,
          cover_url,
          duration_ms
        )
      `
      )
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const albumIds = [
      ...new Set(
        (history || [])
          .map((h) => h.albums?.spotify_id || h.album_id)
          .filter(Boolean)
      ),
    ];

    const reviewMap = {};
    if (albumIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('album_id, rating')
        .eq('user_id', userId)
        .in('album_id', albumIds);

      (reviews || []).forEach((r) => {
        if (r.rating != null) reviewMap[r.album_id] = r.rating;
      });
    }

    const enriched = (history || []).map((item) => {
      const albumId = item.albums?.spotify_id || item.album_id;
      const ratingFromReview = albumId != null ? reviewMap[albumId] : null;
      return {
        ...item,
        rating: ratingFromReview ?? item.rating ?? null,
      };
    });

    const totalMinutes =
      enriched.reduce((acc, item) => acc + (item.albums?.duration_ms || 0), 0) /
      1000 /
      60;

    return NextResponse.json(
      {
        stats: {
          totalAlbumsListened: enriched.length,
          totalMinutesSpended: Math.round(totalMinutes),
        },
        history: enriched,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
