import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getLastFmNowPlaying, getLastFmUsername } from '@/lib/lastfm';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, created_at, is_private, diary_public, show_activity'
      )
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = !!(currentUserId && currentUserId === profile.id);
    const isPrivate = profile.is_private === true;

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profile.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profile.id),
    ]);

    let isFollowing = false;
    if (currentUserId) {
      const { data: followCheck } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
        .maybeSingle();
      if (followCheck) isFollowing = true;
    }

    // Private profile + visitor → limited view
    if (isPrivate && !isOwner) {
      return NextResponse.json({
        profile: {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          is_private: true,
          diary_public: false,
          show_activity: false,
          followers,
          following,
          isFollowing,
          nowPlaying: null,
          favorite_albums: [],
          bio: null,
          website: null,
          pronouns: null,
        },
        listens: [],
        restricted: true,
      });
    }

    const { data: listensData, error: listensError } = await supabase
      .from('listens')
      .select(
        `
        id, rating, review, created_at,
        albums (spotify_id, title, artist, cover_url)
      `
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (listensError) {
      return NextResponse.json(
        { error: 'Error loading history' },
        { status: 500 }
      );
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
      const lastfmUser = await getLastFmUsername(profile.id);
      if (lastfmUser) {
        nowPlaying = await getLastFmNowPlaying(lastfmUser);
      }
    } catch (err) {
      console.error('Error Now Playing Last.fm:', err.message);
    }

    return NextResponse.json({
      profile: {
        ...profile,
        is_private: profile.is_private === true,
        diary_public: profile.diary_public !== false,
        show_activity: profile.show_activity !== false,
        followers,
        following,
        isFollowing,
        nowPlaying,
      },
      listens,
      restricted: false,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
