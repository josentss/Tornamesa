import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!following?.length) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const followingIds = following.map((f) => f.following_id);

    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select('id, album_id, rating, review_text, created_at, user_id')
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    if (!reviewsData?.length) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const userIds = [...new Set(reviewsData.map((r) => r.user_id))];
    const albumIds = [...new Set(reviewsData.map((r) => r.album_id))];

    const [{ data: profiles }, { data: albums }] = await Promise.all([
      supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
      supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .in('spotify_id', albumIds),
    ]);

    const profileMap = {};
    (profiles || []).forEach((p) => {
      profileMap[p.id] = p;
    });
    const albumMap = {};
    (albums || []).forEach((a) => {
      albumMap[a.spotify_id] = a;
    });

    const reviews = reviewsData.map((r) => {
      const profile = profileMap[r.user_id];
      const album = albumMap[r.album_id];
      return {
        id: r.id,
        rating: r.rating,
        reviewText: r.review_text,
        createdAt: r.created_at,
        username: profile?.username || 'user',
        avatar_url: profile?.avatar_url || null,
        album: {
          id: album?.spotify_id || r.album_id,
          title: album?.title || 'Unknown album',
          artist: album?.artist || '',
          cover: album?.cover_url || null,
        },
      };
    });

    return NextResponse.json(reviews, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (err) {
    console.error('Friends reviews error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
