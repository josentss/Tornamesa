import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!following || following.length === 0) {
      return NextResponse.json([]);
    }

    const followingIds = following.map((f) => f.following_id);

    const { data: feedData, error } = await supabase
      .from('listens')
      .select(`
        id, rating, review, created_at,
        profiles!inner(username, avatar_url),
        albums(spotify_id, title, artist, cover_url)
      `)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const formattedFeed = (feedData || []).map((item) => ({
      id: item.id,
      username: item.profiles.username,
      avatar_url: item.profiles.avatar_url,
      album_title: item.albums.title,
      artist_name: item.albums.artist,
      album_cover: item.albums.cover_url,
      rating: item.rating,
      created_at: item.created_at,
    }));

    return NextResponse.json(formattedFeed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
