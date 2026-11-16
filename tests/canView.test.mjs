import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Load the dependency-free ESM helper without changing the Next.js package type.
const content = readFileSync(new URL('../src/lib/canView.js', import.meta.url), 'utf8');
const { canView } = await import(`data:text/javascript,${encodeURIComponent(content)}`);
const owner = { id: 'owner' };
const visitor = { id: 'visitor' };
const open = { id: 'owner', is_private: false, diary_public: true, show_activity: true };

test('missing profile fails closed', () => {
  assert.equal(canView(visitor, null, 'reviews'), false);
  assert.equal(canView(visitor, { is_private: false }, 'diary'), false);
  assert.equal(canView(visitor, { id: 'owner' }, 'reviews'), false);
  assert.equal(canView(visitor, { ...open, diary_public: null }, 'top'), false);
  assert.equal(canView(visitor, open, 'unknown'), false);
});

test('private profile is visible only to its owner across scopes', () => {
  const profile = { ...open, is_private: true };
  for (const scope of ['profile', 'diary', 'top', 'stats', 'reviews', 'lists', 'feed', 'follows']) {
    assert.equal(canView(visitor, profile, scope), false, scope);
    assert.equal(canView(owner, profile, scope), true, scope);
    assert.equal(canView(null, profile, scope), false, scope);
  }
});

test('closing diary hides diary, stats, tops and feed but not reviews or lists', () => {
  const profile = { ...open, diary_public: false };
  for (const scope of ['diary', 'stats', 'top', 'feed']) {
    assert.equal(canView(visitor, profile, scope), false, scope);
    assert.equal(canView(owner, profile, scope), true, scope);
  }
  assert.equal(canView(visitor, profile, 'reviews'), true);
  assert.equal(canView(visitor, profile, 'lists'), true);
});

test('mutual follow grants private-profile sections, without bypassing switches', () => {
  const privateProfile = { ...open, is_private: true };
  for (const scope of ['profile', 'diary', 'top', 'stats', 'reviews', 'lists', 'feed', 'follows']) {
    assert.equal(canView(visitor, privateProfile, scope), false, scope);
    assert.equal(canView(visitor, privateProfile, scope, { mutualFollow: true }), true, scope);
  }
  assert.equal(canView(null, privateProfile, 'profile', { mutualFollow: true }), false);
});

test('one-way follow and private flags cannot be bypassed by reciprocal access', () => {
  const privateProfile = { ...open, is_private: true, diary_public: false, show_activity: false };
  for (const scope of ['diary', 'top', 'stats', 'feed']) {
    assert.equal(canView(visitor, privateProfile, scope, { mutualFollow: true }), false, scope);
    assert.equal(canView(owner, privateProfile, scope), true, scope);
  }
  for (const scope of ['profile', 'reviews', 'lists', 'follows']) {
    assert.equal(canView(visitor, privateProfile, scope, { mutualFollow: true }), true, scope);
  }
});

test('Show recent activity always gates feed, even for mutual followers', () => {
  const publicProfile = { ...open, show_activity: false };
  assert.equal(canView(visitor, publicProfile, 'feed'), false);
  assert.equal(canView(visitor, publicProfile, 'feed', { mutualFollow: true }), false);
  assert.equal(canView(owner, publicProfile, 'feed'), true);
  assert.equal(canView(visitor, publicProfile, 'diary'), true);
});

test('private profile never opens through a missing privacy flag', () => {
  assert.equal(canView(visitor, { id: 'owner', is_private: null }, 'profile', { mutualFollow: true }), false);
  assert.equal(canView(visitor, { id: 'owner', is_private: true, diary_public: true }, 'feed', { mutualFollow: true }), false);
});

test('follow relationships are hidden from non-owners of private profiles', () => {
  const privateProfile = { ...open, is_private: true };
  assert.equal(canView(null, privateProfile, 'follows'), false);
  assert.equal(canView(visitor, privateProfile, 'follows'), false);
  assert.equal(canView(owner, privateProfile, 'follows'), true);
});

test('public follow relationships remain available when diary and activity are closed', () => {
  const publicProfile = { ...open, diary_public: false, show_activity: false };
  assert.equal(canView(null, publicProfile, 'follows'), true);
  assert.equal(canView(visitor, publicProfile, 'follows'), true);
  assert.equal(canView(visitor, { ...publicProfile, is_private: null }, 'follows'), false);
});
