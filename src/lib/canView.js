/**
 * Central read-access policy. The caller must verify reciprocal follows on
 * the server; a caller-supplied mutualFollow flag is never an identity proof.
 * Private profile access is granted to the owner or verified mutual followers.
 * The diary and recent-activity switches independently restrict what is shown.
 */
export function canView(viewer, profile, scope, { mutualFollow = false } = {}) {
  const scopes = ['profile', 'diary', 'top', 'stats', 'reviews', 'lists', 'feed', 'follows'];
  if (!profile?.id || !scopes.includes(scope)) return false;
  if (viewer?.id && viewer.id === profile.id) return true;
  if (profile.is_private !== true && profile.is_private !== false) return false;
  if (profile.is_private === true && !(viewer?.id && mutualFollow === true)) {
    return false;
  }
  if (['diary', 'top', 'stats', 'feed'].includes(scope) && profile.diary_public !== true) {
    return false;
  }
  if (scope === 'feed' && profile.show_activity !== true) return false;
  return true;
}
