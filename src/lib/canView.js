/**
 * Server-side visibility policy. A valid profile with an id is required.
 * "feed" allows hidden activity only when both users follow one another.
 * Privacy must never be decided solely by a client component.
 */
export function canView(viewer, profile, scope, { mutualFollow = false } = {}) {
  const scopes = ['profile', 'diary', 'top', 'stats', 'reviews', 'lists', 'feed', 'follows'];
  if (!profile?.id || !scopes.includes(scope)) return false;
  if (viewer?.id && viewer.id === profile.id) return true;
  // Missing policy fields must not silently mean public.
  if (profile.is_private !== false) return false;
  if (['diary', 'top', 'stats', 'feed'].includes(scope) && profile.diary_public !== true) {
    return false;
  }
  if (scope === 'feed' && profile.show_activity !== true && !mutualFollow) {
    return false;
  }
  return true;
}
