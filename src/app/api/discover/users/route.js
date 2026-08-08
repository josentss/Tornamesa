import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

function mapUser(u, followingSet, currentUserId) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name || null,
    avatar_url: u.avatar_url || null,
    is_private: u.is_private === true,
    isFollowing: followingSet.has(u.id),
    isSelf: currentUserId === u.id,
  };
}

async function attachFollowState(supabase, users, currentUserId) {
  const followingSet = new Set();
  if (currentUserId && users.length > 0) {
    const ids = users.map((u) => u.id);
    const { data: myFollows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .in('following_id', ids);
    (myFollows || []).forEach((f) => followingSet.add(f.following_id));
  }
  return users.map((u) => mapUser(u, followingSet, currentUserId));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 30);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    if (q) {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_private')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .not('username', 'is', null)
        .order('username', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const list = await attachFollowState(
        supabase,
        (users || []).filter((u) => u.username),
        currentUserId
      );

      return NextResponse.json(
        { mode: 'search', query: q, similar: [], active: [], users: list },
        { headers: noStoreHeaders }
      );
    }

    let similar = [];
    let active = [];

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data: recentListens } = await supabase
      .from('listens')
      .select('user_id')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    const activeIds = [
      ...new Set(
        (recentListens || [])
          .map((r) => r.user_id)
          .filter((id) => id && id !== currentUserId)
      ),
    ].slice(0, limit);

    if (activeIds.length > 0) {
      const { data: activeProfiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_private')
        .in('id', activeIds)
        .not('username', 'is', null);
      active = activeProfiles || [];
    }

    if (currentUserId) {
      const { data: myListens } = await supabase
        .from('listens')
        .select('album_id')
        .eq('user_id', currentUserId)
        .not('album_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40);

      const myAlbumIds = [
        ...new Set((myListens || []).map((l) => l.album_id).filter(Boolean)),
      ].slice(0, 25);

      if (myAlbumIds.length > 0) {
        const { data: others } = await supabase
          .from('listens')
          .select('user_id, album_id')
          .in('album_id', myAlbumIds)
          .neq('user_id', currentUserId)
          .limit(300);

        const score = new Map();
        (others || []).forEach((row) => {
          if (!row.user_id) return;
          score.set(row.user_id, (score.get(row.user_id) || 0) + 1);
        });

        const rankedIds = [...score.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)
          .slice(0, limit);

        if (rankedIds.length > 0) {
          const { data: similarProfiles } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, is_private')
            .in('id', rankedIds)
            .not('username', 'is', null);

          const byId = new Map((similarProfiles || []).map((p) => [p.id, p]));
          similar = rankedIds.map((id) => byId.get(id)).filter(Boolean);
        }
      }
    }

    const [similarMapped, activeMapped] = await Promise.all([
      attachFollowState(supabase, similar, currentUserId),
      attachFollowState(supabase, active, currentUserId),
    ]);

    const similarIds = new Set(similarMapped.map((u) => u.id));
    const activeFiltered = activeMapped.filter((u) => !similarIds.has(u.id));

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
