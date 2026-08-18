import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getLastFmNowPlaying, getLastFmUsername } from '@/lib/lastfm';
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

  const authUser = await getRequestUser(request);
  const viewerId = authUser?.id || null;

  const supabase = createSupabaseServer();

  try {
    const { data: base, error: baseError } = await supabase
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, created_at'
      )
      .ilike('username', username)
      .maybeSingle();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { data: privacy, error: privacyError } = await supabase
      .from('profiles')
      .select('is_private, diary_public, show_activity')
      .eq('id', base.id)
      .maybeSingle();

    if (privacyError) {
      return NextResponse.json(
        { error: 'Failed to load profile' },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const is_private = privacy?.is_private === true;
    const diary_public = privacy?.diary_public !== false;
    const show_activity = privacy?.show_activity !== false;

    const isOwner = !!(viewerId && viewerId === base.id);

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', base.id),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', base.id),
    ]);

    let isFollowing = false;
    if (viewerId && viewerId !== base.id) {
      const { data: followCheck } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', viewerId)
        .eq('following_id', base.id)
        .maybeSingle();
      if (followCheck) isFollowing = true;
    }

    if (is_private && !isOwner) {
      return NextResponse.json(
        {
          profile: {
            id: base.id,
            username: base.username,
            full_name: base.full_name,
            avatar_url: base.avatar_url,
            is_private: true,
            diary_public: false,
            show_activity: false,
            followers: followers || 0,
            following: following || 0,
            isFollowing,
            nowPlaying: null,
            favorite_albums: [],
            bio: null,
            website: null,
            pronouns: null,
          },
          listens: [],
          restricted: true,
        },
        { headers: noStoreHeaders }
      );
    }

    const { data: listensData, error: listensError } = await supabase
      .from('listens')
      .select(
        `
        id, rating, review, created_at,
        albums (spotify_id, title, artist, cover_url)
      `
      )
      .eq('user_id', base.id)
      .order('created_at', { ascending: false });

    if (listensError) {
      return NextResponse.json(
        { error: 'Error loading history' },
        { status: 500, headers: noStoreHeaders }
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
      const lastfmUser = await getLastFmUsername(base.id);
      if (lastfmUser) {
        nowPlaying = await getLastFmNowPlaying(lastfmUser);
      }
    } catch (err) {
      console.error('Error Now Playing Last.fm:', err.message);
    }

    return NextResponse.json(
      {
        profile: {
          ...base,
          is_private,
          diary_public,
          show_activity,
          followers: followers || 0,
          following: following || 0,
          isFollowing,
          nowPlaying,
        },
        listens,
        restricted: false,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
