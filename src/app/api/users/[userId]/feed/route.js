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

    if (!following || following.length === 0) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const followingIds = following.map((f) => f.following_id);

    const { data: feedData, error } = await supabase
      .from('listens')
      .select(`
        id,
        rating,
        review,
        listened_at,
        created_at,
        album_id,
        user_id,
        profiles ( username, avatar_url ),
        albums ( spotify_id, title, artist, cover_url )
      `)
      .in('user_id', followingIds)
      .order('listened_at', { ascending: false, nullsFirst: false })
      .limit(24);

    if (error) throw error;

    const formattedFeed = (feedData || [])
      .filter((item) => item.albums?.spotify_id || item.album_id)
      .map((item) => ({
        id: item.id,
        username: item.profiles?.username || 'user',
        avatar_url: item.profiles?.avatar_url || null,
        album_id: item.albums?.spotify_id || item.album_id,
        album_title: item.albums?.title || 'Unknown album',
        artist_name: item.albums?.artist || '',
        album_cover: item.albums?.cover_url || null,
        rating: item.rating,
        listened_at: item.listened_at || item.created_at,
      }));

    return NextResponse.json(formattedFeed, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
