import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const content = readFileSync(new URL('../src/lib/privacyPreferences.js', import.meta.url), 'utf8');
const { fromPrivacyResponse, toPrivacyPayload, canEditRecentActivity } =
  await import(`data:text/javascript,${encodeURIComponent(content)}`);

test('privacy responses require all explicit booleans before displaying saved', () => {
  const valid = { is_private: true, diary_public: false, show_activity: true };
  assert.deepEqual(fromPrivacyResponse(valid), {
    isPrivate: true, diaryPublic: false, showActivity: true,
  });
  assert.throws(() => fromPrivacyResponse(null), /Incomplete privacy/);
  assert.throws(() => fromPrivacyResponse({ ...valid, show_activity: undefined }), /Incomplete privacy/);
  assert.throws(() => fromPrivacyResponse({ ...valid, is_private: 'true' }), /Incomplete privacy/);
});

test('turning off the diary pauses activity control without erasing preference', () => {
  const loaded = fromPrivacyResponse({ is_private: true, diary_public: false, show_activity: true });
  assert.equal(canEditRecentActivity(loaded), false);
  assert.equal(toPrivacyPayload(loaded).show_activity, true);

  const reopened = { ...loaded, diaryPublic: true };
  assert.equal(canEditRecentActivity(reopened), true);
  assert.equal(toPrivacyPayload(reopened).show_activity, true);
});

test('activity switch is editable only with a public diary', () => {
  assert.equal(canEditRecentActivity({ diaryPublic: false }), false);
  assert.equal(canEditRecentActivity({ diaryPublic: true }), true);
  assert.equal(canEditRecentActivity(null), false);
});

test('privacy payload preserves separate switches and private profile value', () => {
  const input = { isPrivate: true, diaryPublic: true, showActivity: false };
  assert.deepEqual(toPrivacyPayload(input), {
    is_private: true, diary_public: true, show_activity: false,
  });
});
