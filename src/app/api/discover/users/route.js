import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

function mapUser(u, followingSet, currentUserId, extra = {}) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name || null,
    avatar_url: u.avatar_url || null,
    is_private: u.is_private === true,
    isFollowing: followingSet.has(u.id),
    isSelf: currentUserId === u.id,
    sharedCount: extra.sharedCount ?? null,
    sharedAlbums: extra.sharedAlbums ?? [],
  };
}

async function getFollowingSet(supabase, currentUserId) {
  const set = new Set();
  if (!currentUserId) return set;
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId);
  (data || []).forEach((f) => set.add(f.following_id));
  return set;
}

async function getMyTenStarAlbumIds(supabase, userId) {
  const ids = new Set();

  const [{ data: listenRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from('listens')
      .select('album_id')
      .eq('user_id', userId)
      .eq('rating', 10)
      .not('album_id', 'is', null)
      .limit(200),
    supabase
      .from('reviews')
      .select('album_id')
      .eq('user_id', userId)
      .eq('rating', 10)
      .not('album_id', 'is', null)
      .limit(200),
  ]);

  (listenRows || []).forEach((r) => {
    if (r.album_id) ids.add(r.album_id);
  });
  (reviewRows || []).forEach((r) => {
    if (r.album_id) ids.add(r.album_id);
  });

  return [...ids].slice(0, 80);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 30);
  const currentUserId = searchParams.get('currentUserId') || null;

  const supabase = createSupabaseServer();

  try {
    const followingSet = await getFollowingSet(supabase, currentUserId);

    if (q) {
      const safe = q.replace(/[%_,]/g, '');
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_private')
        .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
        .not('username', 'is', null)
        .order('username', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const list = (users || [])
        .filter((u) => u.username)
        .map((u) => mapUser(u, followingSet, currentUserId));

      return NextResponse.json(
        { mode: 'search', query: q, similar: [], users: list },
        { headers: noStoreHeaders }
      );
    }

    let similar = [];

    if (currentUserId) {
      const myAlbumIds = await getMyTenStarAlbumIds(supabase, currentUserId);

      if (myAlbumIds.length > 0) {
        const [{ data: otherListens }, { data: otherReviews }] =
          await Promise.all([
            supabase
              .from('listens')
              .select('user_id, album_id')
              .in('album_id', myAlbumIds)
              .neq('user_id', currentUserId)
              .limit(600),
            supabase
              .from('reviews')
              .select('user_id, album_id')
              .in('album_id', myAlbumIds)
              .neq('user_id', currentUserId)
              .limit(400),
          ]);

        const albumsByUser = new Map();

        const add = (userId, albumId) => {
          if (!userId || !albumId || userId === currentUserId) return;
          if (followingSet.has(userId)) return;
          if (!albumsByUser.has(userId)) albumsByUser.set(userId, new Set());
          albumsByUser.get(userId).add(albumId);
        };

        (otherListens || []).forEach((r) => add(r.user_id, r.album_id));
        (otherReviews || []).forEach((r) => add(r.user_id, r.album_id));

        const ranked = [...albumsByUser.entries()]
          .map(([id, set]) => ({
            id,
            sharedCount: set.size,
            albumIds: [...set],
          }))
          .filter((x) => x.sharedCount >= 1)
          .sort((a, b) => b.sharedCount - a.sharedCount)
          .slice(0, limit);

        if (ranked.length > 0) {
          const rankedIds = ranked.map((r) => r.id);
          const sampleIds = [
            ...new Set(ranked.flatMap((r) => r.albumIds.slice(0, 3))),
          ].slice(0, 40);

          const [{ data: profiles }, { data: albumRows }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url, is_private')
              .in('id', rankedIds)
              .not('username', 'is', null),
            sampleIds.length
              ? supabase
                  .from('albums')
                  .select('spotify_id, title, artist, cover_url')
                  .in('spotify_id', sampleIds)
              : Promise.resolve({ data: [] }),
          ]);

          const albumMap = new Map(
            (albumRows || []).map((a) => [a.spotify_id, a])
          );
          const profileById = new Map((profiles || []).map((p) => [p.id, p]));

          similar = ranked
            .map((r) => {
              const p = profileById.get(r.id);
              if (!p || p.id === currentUserId) return null;
              const sharedAlbums = r.albumIds
                .slice(0, 3)
                .map((aid) => {
                  const a = albumMap.get(aid);
                  if (!a) return null;
                  return {
                    id: a.spotify_id,
                    title: a.title,
                    artist: a.artist,
                    cover: a.cover_url,
                  };
                })
                .filter(Boolean);

              return mapUser(p, followingSet, currentUserId, {
                sharedCount: r.sharedCount,
                sharedAlbums,
              });
            })
            .filter(Boolean);
        }
      }
    }

    return NextResponse.json(
      {
        mode: 'recommend',
        query: null,
        similar,
        users: [],
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('GET discover/users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load users' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
