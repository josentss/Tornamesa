import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { data: rows, error } = await supabase
      .from('follows')
      .select(
        `
        following_id,
        profiles:following_id (
          id,
          username,
          full_name,
          avatar_url,
          is_private
        )
      `
      )
      .eq('follower_id', profile.id)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const users = (rows || [])
      .map((r) => r.profiles)
      .filter(Boolean);

    let followingSet = new Set();
    if (currentUserId && users.length > 0) {
      const ids = users.map((u) => u.id);
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', ids);
      followingSet = new Set((myFollows || []).map((f) => f.following_id));
    }

    const list = users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name || null,
      avatar_url: u.avatar_url || null,
      is_private: u.is_private === true,
      isFollowing: followingSet.has(u.id),
      isSelf: currentUserId === u.id,
    }));

    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id);

    return NextResponse.json(
      {
        username: profile.username,
        type: 'following',
        total: count || 0,
        users: list,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('GET following:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load following' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
