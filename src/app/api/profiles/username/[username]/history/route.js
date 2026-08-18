import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const authUser = await getRequestUser(request);
  const viewerId = authUser?.id || null;

  const supabase = createSupabaseServer();

  try {
    const { data: base, error: baseError } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { data: privacy } = await supabase
      .from('profiles')
      .select('is_private, diary_public')
      .eq('id', base.id)
      .maybeSingle();

    const isOwner = !!(viewerId && viewerId === base.id);
    const isPrivate = privacy?.is_private === true;
    const diaryClosed = privacy?.diary_public === false;

    if (!isOwner && (isPrivate || diaryClosed)) {
      return NextResponse.json(
        { error: 'This diary is private' },
        { status: 403, headers: noStoreHeaders }
      );
    }

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
      .eq('user_id', base.id)
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
        .select('album_id, rating, review')
        .eq('user_id', base.id)
        .in('album_id', albumIds);

      (reviews || []).forEach((r) => {
        if (r.rating != null) reviewMap[r.album_id] = r;
      });
    }

    const enriched = (history || []).map((item) => {
      const albumId = item.albums?.spotify_id || item.album_id;
      const fromReview = albumId != null ? reviewMap[albumId] : null;
      return {
        ...item,
        rating: fromReview?.rating ?? item.rating ?? null,
        review: item.review || fromReview?.review || null,
      };
    });

    return NextResponse.json(
      {
        username: base.username,
        history: enriched,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('GET history:', error);
    return NextResponse.json(
      { error: 'Failed to load diary' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
