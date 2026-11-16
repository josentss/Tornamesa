import { canView } from '@/lib/canView';

/**
 * Public follow directories include every participant, including private
 * profiles. A private account's own directory is owner-only.
 *
 * This is deliberately a service-role read AFTER checking the directory
 * owner's visibility. Keep the installed follows_select RLS policy stricter:
 * unrestricted direct Supabase clients must not enumerate private accounts.
 */
export async function getFollowPage(
  supabase,
  viewer,
  profile,
  type,
  limit,
  offset
) {
  if (!canView(viewer, profile, 'follows')) {
    throw new Error('Private follow directory');
  }
  if (type !== 'followers' && type !== 'following') {
    throw new Error('Invalid follow list type');
  }

  const ownerColumn = type === 'followers' ? 'following_id' : 'follower_id';
  const relatedColumn = type === 'followers' ? 'follower_id' : 'following_id';

  const { data: edges, count, error } = await supabase
    .from('follows')
    .select(relatedColumn, { count: 'exact' })
    .eq(ownerColumn, profile.id)
    .order(relatedColumn, { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const ids = (edges || []).map((edge) => edge[relatedColumn]).filter(Boolean);
  if (!ids.length) return { users: [], total: count ?? 0 };

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, is_private')
    .in('id', ids);
  if (profilesError) throw profilesError;

  const byId = new Map((profiles || []).map((item) => [item.id, item]));
  return {
    users: ids.map((id) => byId.get(id)).filter(Boolean),
    total: count ?? 0,
  };
}

/**
 * Counts are public metadata, including on a private profile shell. Access
 * to the relationship directory still requires canView(..., 'follows').
 */
export async function getFollowCounts(supabase, profileId) {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', profileId),
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId),
  ]);
  if (followers.error || following.error) throw followers.error || following.error;
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}
