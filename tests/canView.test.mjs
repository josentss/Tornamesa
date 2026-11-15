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

test('mutual follow reveals hidden feed only for nonprivate, open diary', () => {
  const profile = { ...open, show_activity: false };
  assert.equal(canView(visitor, profile, 'feed'), false);
  assert.equal(canView(visitor, profile, 'feed', { mutualFollow: true }), true);
  assert.equal(canView(visitor, { ...profile, is_private: true }, 'feed', { mutualFollow: true }), false);
  assert.equal(canView(visitor, { ...profile, diary_public: false }, 'feed', { mutualFollow: true }), false);
});
