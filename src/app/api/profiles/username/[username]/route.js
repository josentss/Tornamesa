import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getUserSpotifyToken } from '@/lib/spotify';

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, created_at')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    ]);

    let isFollowing = false;
    if (currentUserId) {
      const { data: followCheck } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
        .single();
      if (followCheck) isFollowing = true;
    }

    const { data: listensData, error: listensError } = await supabase
      .from('listens')
      .select(`
        id, rating, review, created_at,
        albums (spotify_id, title, artist, cover_url)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (listensError) {
      return NextResponse.json({ error: 'Error al obtener el historial' }, { status: 500 });
    }

    const listens = (listensData || []).map((item) => ({
      id: item.id,
      rating: item.rating,
      review: item.review,
      created_at: item.created_at,
      album_id: item.albums?.spotify_id,
      album_title: item.albums?.title || 'Unknown Album',
      artist_name: item.albums?.artist || 'Unknown Artist',
      album_cover: item.albums?.cover_url || null,
    }));

    let nowPlaying = null;
    try {
      const userAccessToken = await getUserSpotifyToken(profile.id);
      if (userAccessToken) {
        const playerResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: { Authorization: `Bearer ${userAccessToken}` },
        });
        if (playerResponse.status === 200) {
          const playerData = await playerResponse.json();
          if (playerData?.is_playing && playerData.item) {
            nowPlaying = {
              isPlaying: true,
              title: playerData.item.name,
              artist: playerData.item.artists.map((a) => a.name).join(', '),
              spotifyUrl: playerData.item.external_urls.spotify,
            };
          }
        }
      }
    } catch (err) {
      console.error('Error Now Playing:', err.message);
    }

    return NextResponse.json({
      profile: { ...profile, followers, following, isFollowing, nowPlaying },
      listens,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
