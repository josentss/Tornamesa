import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { userId } = params;

  const authUser = await getRequestUser(request);
  if (!authUser) return unauthorized();
  if (authUser.id !== userId) return forbidden();

  const supabase = createSupabaseServer();

  try {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!following || following.length === 0) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const followingIds = following.map((f) => f.following_id);

    const { data: feedData, error } = await supabase
      .from('listens')
      .select(
        `
        id,
        rating,
        review,
        listened_at,
        created_at,
        album_id,
        user_id,
        profiles ( username, avatar_url ),
        albums ( spotify_id, title, artist, cover_url )
      `
      )
      .in('user_id', followingIds)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(40);

    if (error) throw error;

    const rows = feedData || [];

    const pairKeys = rows
      .map((item) => {
        const aid = item.albums?.spotify_id || item.album_id;
        if (!aid || !item.user_id) return null;
        return { user_id: item.user_id, album_id: aid };
      })
      .filter(Boolean);

    const reviewMap = {};
    if (pairKeys.length > 0) {
      const userIds = [...new Set(pairKeys.map((p) => p.user_id))];
      const albumIds = [...new Set(pairKeys.map((p) => p.album_id))];

      const { data: reviews } = await supabase
        .from('reviews')
        .select('user_id, album_id, rating')
        .in('user_id', userIds)
        .in('album_id', albumIds);

      (reviews || []).forEach((r) => {
        if (r.rating != null) {
          reviewMap[`${r.user_id}:${r.album_id}`] = r.rating;
        }
      });
    }

    const formattedFeed = rows
      .filter((item) => item.albums?.spotify_id || item.album_id)
      .map((item) => {
        const albumId = item.albums?.spotify_id || item.album_id;
        const fromReview = reviewMap[`${item.user_id}:${albumId}`];
        const created = item.created_at || null;
        const listened = item.listened_at || null;
        const activityAt = created || listened;

        return {
          id: item.id,
          username: item.profiles?.username || 'user',
          avatar_url: item.profiles?.avatar_url || null,
          album_id: albumId,
          album_title: item.albums?.title || 'Unknown album',
          artist_name: item.albums?.artist || '',
          album_cover: item.albums?.cover_url || null,
          rating: fromReview ?? item.rating ?? null,
          listened_at: listened || created,
          created_at: created,
          activity_at: activityAt,
        };
      })
      .sort((a, b) => {
        const tb = new Date(b.activity_at || 0).getTime();
        const ta = new Date(a.activity_at || 0).getTime();
        return tb - ta;
      });

    return NextResponse.json(formattedFeed, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
