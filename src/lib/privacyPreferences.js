/**
 * UI representation of stored privacy flags.
 * A missing or malformed server response must never be treated as a saved value.
 * The activity preference is stored independently, even when the diary is off.
 */
export function fromPrivacyResponse(value) {
  const keys = ['is_private', 'diary_public', 'show_activity'];
  if (!value || keys.some((key) => typeof value[key] !== 'boolean')) {
    throw new Error('Incomplete privacy settings response');
  }
  return {
    isPrivate: value.is_private,
    diaryPublic: value.diary_public,
    showActivity: value.show_activity,
  };
}

export function toPrivacyPayload(settings) {
  return {
    is_private: settings.isPrivate,
    diary_public: settings.diaryPublic,
    show_activity: settings.showActivity,
  };
}

export function canEditRecentActivity(settings) {
  return settings?.diaryPublic === true;
}
