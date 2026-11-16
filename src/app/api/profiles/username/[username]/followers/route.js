import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canView } from '@/lib/canView';
import { getFollowPage } from '@/lib/followsVisibility';

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
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '40', 10);
  const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 100))
    : 40;
  const offset = Number.isSafeInteger(requestedOffset)
    ? Math.max(0, requestedOffset)
    : 0;
  const authUser = await getRequestUser(request);
  const currentUserId = authUser?.id || null;

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, is_private')
      .ilike('username', username)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    if (!canView(authUser, profile, 'follows')) {
      return NextResponse.json(
        { error: 'This profile is private' },
        { status: 403, headers: noStoreHeaders }
      );
    }

    // The subject's directory is authorized above. Include private participants.
    const { users, total } = await getFollowPage(
      supabase, authUser, profile, 'followers', limit, offset
    );

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

    return NextResponse.json(
      {
        username: profile.username,
        type: 'followers',
        total,
        users: list,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('GET followers:', error);
    return NextResponse.json(
      { error: 'Failed to load followers' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
