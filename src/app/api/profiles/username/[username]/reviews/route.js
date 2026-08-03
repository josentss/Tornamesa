import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: reviewsData, error } = await supabase
      .from('reviews')
      .select('id, album_id, rating, review_text, created_at, updated_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    if (!reviewsData?.length) {
      return NextResponse.json(
        { username: profile.username, reviews: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const albumIds = [...new Set(reviewsData.map((r) => r.album_id))];
    const { data: albums } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .in('spotify_id', albumIds);

    const albumMap = {};
    (albums || []).forEach((a) => {
      albumMap[a.spotify_id] = a;
    });

    const reviews = reviewsData.map((r) => {
      const album = albumMap[r.album_id];
      return {
        id: r.id,
        rating: r.rating,
        reviewText: r.review_text,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        album: album
          ? {
              id: album.spotify_id,
              title: album.title,
              artist: album.artist,
              cover: album.cover_url,
            }
          : {
              id: r.album_id,
              title: 'Unknown album',
              artist: '',
              cover: null,
            },
      };
    });

    return NextResponse.json(
      { username: profile.username, reviews },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (err) {
    console.error('GET user reviews error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
