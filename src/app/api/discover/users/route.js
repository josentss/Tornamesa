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

function attachFollowState(users, followingSet, currentUserId, extrasById = {}) {
  return users.map((u) =>
    mapUser(u, followingSet, currentUserId, extrasById[u.id] || {})
  );
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

      const list = attachFollowState(
        (users || []).filter((u) => u.username),
        followingSet,
        currentUserId
      );

      return NextResponse.json(
        { mode: 'search', query: q, similar: [], active: [], users: list },
        { headers: noStoreHeaders }
      );
    }

    let similarRaw = [];
    let extrasById = {};
    let active = [];

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data: recentListens } = await supabase
      .from('listens')
      .select('user_id')
      .gte('listened_at', since.toISOString())
      .order('listened_at', { ascending: false })
      .limit(400);

    const activeIds = [
      ...new Set(
        (recentListens || [])
          .map((r) => r.user_id)
          .filter((id) => id && id !== currentUserId)
      ),
    ].slice(0, limit * 2);

    if (activeIds.length > 0) {
      const { data: activeProfiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_private')
        .in('id', activeIds)
        .not('username', 'is', null);
      const byId = new Map((activeProfiles || []).map((p) => [p.id, p]));
      active = activeIds.map((id) => byId.get(id)).filter(Boolean).slice(0, limit);
    }

    if (currentUserId) {
      const { data: myListens } = await supabase
        .from('listens')
        .select('album_id')
        .eq('user_id', currentUserId)
        .not('album_id', 'is', null)
        .order('listened_at', { ascending: false })
        .limit(200);

      const myAlbumIds = [
        ...new Set((myListens || []).map((l) => l.album_id).filter(Boolean)),
      ].slice(0, 60);

      if (myAlbumIds.length > 0) {
        const { data: others } = await supabase
          .from('listens')
          .select('user_id, album_id')
          .in('album_id', myAlbumIds)
          .neq('user_id', currentUserId)
          .limit(800);

        const albumsByUser = new Map();
        (others || []).forEach((row) => {
          if (!row.user_id || !row.album_id) return;
          if (!albumsByUser.has(row.user_id)) {
            albumsByUser.set(row.user_id, new Set());
          }
          albumsByUser.get(row.user_id).add(row.album_id);
        });

        const ranked = [...albumsByUser.entries()]
          .filter(([uid]) => !followingSet.has(uid))
          .map(([uid, set]) => ({
            id: uid,
            sharedCount: set.size,
            albumIds: [...set],
          }))
          .filter((x) => x.sharedCount >= 1)
          .sort((a, b) => b.sharedCount - a.sharedCount)
          .slice(0, limit);

        if (ranked.length > 0) {
          const rankedIds = ranked.map((r) => r.id);
          const sampleAlbumIds = [
            ...new Set(ranked.flatMap((r) => r.albumIds.slice(0, 3))),
          ].slice(0, 40);

          const [{ data: similarProfiles }, { data: albumRows }] =
            await Promise.all([
              supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url, is_private')
                .in('id', rankedIds)
                .not('username', 'is', null),
              sampleAlbumIds.length
                ? supabase
                    .from('albums')
                    .select('spotify_id, title, artist, cover_url')
                    .in('spotify_id', sampleAlbumIds)
                : Promise.resolve({ data: [] }),
            ]);

          const albumMap = new Map(
            (albumRows || []).map((a) => [a.spotify_id, a])
          );
          const profileById = new Map(
            (similarProfiles || []).map((p) => [p.id, p])
          );

          similarRaw = [];
          ranked.forEach((r) => {
            const p = profileById.get(r.id);
            if (!p) return;
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

            similarRaw.push(p);
            extrasById[r.id] = {
              sharedCount: r.sharedCount,
              sharedAlbums,
            };
          });
        }
      }
    }

    const similarMapped = attachFollowState(
      similarRaw,
      followingSet,
      currentUserId,
      extrasById
    );
    const activeMapped = attachFollowState(
      active,
      followingSet,
      currentUserId
    );

    const similarIds = new Set(similarMapped.map((u) => u.id));
    const activeFiltered = activeMapped.filter(
      (u) => !similarIds.has(u.id) && !u.isFollowing && !u.isSelf
    );

    return NextResponse.json(
      {
        mode: 'recommend',
        query: null,
        similar: similarMapped,
        active: activeFiltered,
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
