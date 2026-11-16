import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../src/lib/canView.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../src/lib/visibilityAccess.js', import.meta.url), 'utf8');
const aliasImport = "import { canView } from '@/lib/canView';";
assert.equal(helper.split(aliasImport).length - 1, 1);
const { getMutualFollowIds, isMutualFollow, canViewWithFollows } = await import(
  `data:text/javascript,${encodeURIComponent(helper.replace(aliasImport, policy))}`
);

const A = { id: 'A' };
const privateB = { id: 'B', is_private: true, diary_public: true, show_activity: true };
const openC = { id: 'C', is_private: false, diary_public: true, show_activity: true };
const pairs = [{ follower_id: 'A', following_id: 'B' }, { follower_id: 'B', following_id: 'A' },
  { follower_id: 'A', following_id: 'C' }];

function mockFollows(edges = pairs, forcedError = null) {
  let queries = 0;
  const db = {
    from(table) {
      assert.equal(table, 'follows');
      queries++;
      return {
        select(column) {
          return {
            eq(field, id) {
              return {
                in(other, candidates) {
                  return Promise.resolve({
                    data: edges
                      .filter((edge) => edge[field] === id && candidates.includes(edge[other]))
                      .map((edge) => ({ [column]: edge[column] })),
                    error: forcedError,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  return { db, get queries() { return queries; } };
}

test('both directions are required for private-profile access', async () => {
  const mutual = mockFollows();
  assert.equal(await canViewWithFollows(mutual.db, A, privateB, 'profile'), true);
  assert.equal(await canViewWithFollows(mutual.db, A, privateB, 'diary'), true);
  assert.equal(await canViewWithFollows(mutual.db, A, privateB, 'feed'), true);

  const oneWay = mockFollows(pairs.filter((p) => p.follower_id !== 'B'));
  assert.equal(await canViewWithFollows(oneWay.db, A, privateB, 'profile'), false);
  const reverseOnly = mockFollows(pairs.filter((p) => p.follower_id !== 'A'));
  assert.equal(await canViewWithFollows(reverseOnly.db, A, privateB, 'profile'), false);
  assert.equal(await canViewWithFollows(oneWay.db, null, privateB, 'profile'), false);
});

test('privacy switches still deny a mutual visitor independently', async () => {
  const m = mockFollows();
  assert.equal(await canViewWithFollows(m.db, A, { ...privateB, diary_public: false }, 'diary'), false);
  assert.equal(await canViewWithFollows(m.db, A, { ...privateB, diary_public: false }, 'top'), false);
  assert.equal(await canViewWithFollows(m.db, A, { ...privateB, diary_public: false }, 'stats'), false);
  assert.equal(await canViewWithFollows(m.db, A, { ...privateB, show_activity: false }, 'feed'), false);
  assert.equal(await canViewWithFollows(m.db, A, { ...privateB, show_activity: false }, 'profile'), true);
  assert.equal(await canViewWithFollows(m.db, { id: 'B' }, { ...privateB, diary_public: false }, 'diary'), true);
});

test('public, owner and stranger reads never require mutual queries', async () => {
  const m = mockFollows();
  assert.equal(await canViewWithFollows(m.db, null, openC, 'profile'), true);
  assert.equal(await canViewWithFollows(m.db, { id: 'B' }, privateB, 'profile'), true);
  assert.equal(await canViewWithFollows(m.db, null, privateB, 'profile'), false);
  assert.equal(m.queries, 0);
});

test('batch detects only reciprocated profiles and no arbitrary others', async () => {
  const m = mockFollows();
  const result = await getMutualFollowIds(m.db, A, ['B', 'C', 'D', 'B']);
  assert.deepEqual([...result], ['B']);
  assert.equal(await isMutualFollow(m.db, A, privateB), true);
  assert.equal(await isMutualFollow(m.db, A, openC), false);
});

test('missing or failing follow lookup never exposes private data', async () => {
  const failed = mockFollows(pairs, new Error('Database unavailable'));
  await assert.rejects(getMutualFollowIds(failed.db, A, ['B']), /Database unavailable/);
  await assert.rejects(canViewWithFollows(failed.db, A, privateB, 'profile'), /Database unavailable/);
  const m = mockFollows();
  assert.deepEqual([...await getMutualFollowIds(m.db, null, ['B'])], []);
  assert.deepEqual([...await getMutualFollowIds(m.db, A, [])], []);
  assert.equal(m.queries, 0);
});
