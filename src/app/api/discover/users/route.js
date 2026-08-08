import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    let query = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_private, created_at')
      .not('username', 'is', null)
      .neq('username', '');

    if (q) {
      // Search by username or full name
      query = query.or(
        `username.ilike.%${q}%,full_name.ilike.%${q}%`
      );
    }

    // Prefer recently joined when browsing; search results still sorted by username
    if (q) {
      query = query.order('username', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: users, error } = await query;
    if (error) throw error;

    let followingSet = new Set();
    if (currentUserId && users?.length) {
      const ids = users.map((u) => u.id);
      const { data: myFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', ids);
      followingSet = new Set((myFollows || []).map((f) => f.following_id));
    }

    const list = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name || null,
      avatar_url: u.avatar_url || null,
      is_private: u.is_private === true,
      isFollowing: followingSet.has(u.id),
      isSelf: currentUserId === u.id,
    }));

    return NextResponse.json(
      {
        query: q || null,
        users: list,
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
