/**
 * Read follow relations with an anon/authenticated Supabase client, never with
 * service_role. The installed follows_select RLS policy determines visibility:
 * participants see their edge; otherwise both accounts must be public.
 * Hydrate only the RLS-approved IDs with the server client.
 */
export async function getVisibleFollowPage(
  readClient,
  serverClient,
  type,
  profileId,
  limit,
  offset
) {
  const ownerColumn = type === 'followers' ? 'following_id' : 'follower_id';
  const relatedColumn = type === 'followers' ? 'follower_id' : 'following_id';
  if (type !== 'followers' && type !== 'following') {
    throw new Error('Invalid follow list type');
  }

  const { data: edges, count, error } = await readClient
    .from('follows')
    .select(relatedColumn, { count: 'exact' })
    .eq(ownerColumn, profileId)
    .order(relatedColumn, { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const ids = (edges || []).map((edge) => edge[relatedColumn]).filter(Boolean);
  if (!ids.length) return { users: [], total: count ?? 0 };

  const { data: profiles, error: profilesError } = await serverClient
    .from('profiles')
    .select('id, username, full_name, avatar_url, is_private')
    .in('id', ids);
  if (profilesError) throw profilesError;

  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return {
    users: ids.map((id) => byId.get(id)).filter(Boolean),
    total: count ?? 0,
  };
}

export async function getVisibleFollowCounts(readClient, profileId) {
  const [followers, following] = await Promise.all([
    readClient.from('follows').select('*', { count: 'exact', head: true })
      .eq('following_id', profileId),
    readClient.from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId),
  ]);
  if (followers.error || following.error) throw followers.error || following.error;
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}
