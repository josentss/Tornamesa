import { canView } from '@/lib/canView';

/**
 * Reciprocated relationships, checked using the authenticated viewer id.
 * Service-role may read raw follow edges, so always verify BOTH directions.
 * Fail closed on a database error. Never accept a viewer id from URL/body.
 */
export async function getMutualFollowIds(supabase, viewer, candidates) {
  if (!viewer?.id || !Array.isArray(candidates)) return new Set();
  const ids = [...new Set(candidates.filter(Boolean).filter((id) => id !== viewer.id))];
  if (!ids.length) return new Set();

  const reciprocal = new Set();
  // Avoid excessively long "in" filters for album reviews/discovery.
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [forward, backward] = await Promise.all([
      supabase.from('follows').select('following_id')
        .eq('follower_id', viewer.id).in('following_id', chunk),
      supabase.from('follows').select('follower_id')
        .eq('following_id', viewer.id).in('follower_id', chunk),
    ]);
    if (forward.error || backward.error) throw forward.error || backward.error;
    const follows = new Set((forward.data || []).map((row) => row.following_id));
    for (const row of backward.data || []) {
      if (follows.has(row.follower_id)) reciprocal.add(row.follower_id);
    }
  }
  return reciprocal;
}

export async function isMutualFollow(supabase, viewer, profile) {
  if (!viewer?.id || !profile?.id || viewer.id === profile.id) return false;
  if (profile.is_private !== true) return false;
  const ids = await getMutualFollowIds(supabase, viewer, [profile.id]);
  return ids.has(profile.id);
}

export async function canViewWithFollows(supabase, viewer, profile, scope) {
  if (canView(viewer, profile, scope)) return true;
  if (profile?.is_private !== true || !viewer?.id) return false;
  return canView(viewer, profile, scope, {
    mutualFollow: await isMutualFollow(supabase, viewer, profile),
  });
}
