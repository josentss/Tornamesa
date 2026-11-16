import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Load the production helper and real policy together without changing package
// type or requiring Next.js: substitute only its @/ alias import.
const policySource = readFileSync(new URL('../src/lib/canView.js', import.meta.url), 'utf8');
const helperSource = readFileSync(new URL('../src/lib/followsVisibility.js', import.meta.url), 'utf8');
const importLine = "import { canView } from '@/lib/canView';";
assert.equal(helperSource.split(importLine).length - 1, 1);
const { getFollowPage, getFollowCounts } = await import(
  `data:text/javascript,${encodeURIComponent(helperSource.replace(importLine, policySource))}`
);

const edges = [
  { follower_id: 'private-b', following_id: 'public-a' },
  { follower_id: 'public-c', following_id: 'public-a' },
  { follower_id: 'public-a', following_id: 'private-b' },
  { follower_id: 'public-a', following_id: 'public-c' },
  { follower_id: 'private-b', following_id: 'public-c' },
];
const profiles = [
  { id: 'public-a', username: 'a', is_private: false },
  { id: 'private-b', username: 'b', is_private: true },
  { id: 'public-c', username: 'c', is_private: false },
];
const visitor = { id: 'visitor' };
const ownerA = { id: 'public-a' };
const ownerB = { id: 'private-b' };

function serviceClient({ rows = edges, profileRows = profiles, followError = null, profileError = null } = {}) {
  const calls = { follows: 0, profiles: 0 };
  const client = {
    from(table) {
      assert.ok(['follows', 'profiles'].includes(table));
      calls[table] += 1;
      if (table === 'profiles') {
        return {
          select(fields) {
            assert.match(fields, /is_private/);
            return {
              in(field, ids) {
                assert.equal(field, 'id');
                return Promise.resolve({
                  data: profileRows.filter((p) => ids.includes(p.id)),
                  error: profileError,
                });
              },
            };
          },
        };
      }
      return {
        select(field, options) {
          assert.equal(options?.count, 'exact');
          return {
            eq(filterColumn, id) {
              const matching = rows.filter((edge) => edge[filterColumn] === id);
              if (options.head) {
                return Promise.resolve({ count: matching.length, error: followError });
              }
              return {
                order(orderColumn) {
                  return {
                    range(start, end) {
                      const ordered = matching.slice().sort((a, b) =>
                        a[orderColumn].localeCompare(b[orderColumn])
                      );
                      return Promise.resolve({
                        data: ordered.slice(start, end + 1).map((row) => ({
                          [field]: row[field],
                        })),
                        count: matching.length,
                        error: followError,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test('public A followers include private B for an anonymous visitor', async () => {
  const { client } = serviceClient();
  const page = await getFollowPage(client, null, profiles[0], 'followers', 40, 0);
  assert.deepEqual(page.users.map((p) => p.username), ['b', 'c']);
  assert.equal(page.total, 2);
  assert.equal(page.users[0].is_private, true);
});

test('public A following includes private B even for unrelated C', async () => {
  const { client } = serviceClient();
  const page = await getFollowPage(client, visitor, profiles[0], 'following', 40, 0);
  assert.deepEqual(page.users.map((p) => p.username), ['b', 'c']);
  assert.equal(page.total, 2);
});

test('private B directory opens only for owner or server-verified mutual access', async () => {
  const { client, calls } = serviceClient();
  await assert.rejects(getFollowPage(client, visitor, profiles[1], 'followers', 40, 0), /Private follow directory/);
  await assert.rejects(getFollowPage(client, ownerA, profiles[1], 'following', 40, 0), /Private follow directory/);
  await assert.rejects(getFollowPage(client, null, profiles[1], 'followers', 40, 0), /Private follow directory/);
  assert.equal(calls.follows, 0);
  assert.equal(calls.profiles, 0);
  const ownerFollowers = await getFollowPage(client, ownerB, profiles[1], 'followers', 40, 0);
  const ownerFollowing = await getFollowPage(client, ownerB, profiles[1], 'following', 40, 0);
  assert.deepEqual(ownerFollowers.users.map((p) => p.username), ['a']);
  assert.deepEqual(ownerFollowing.users.map((p) => p.username), ['a', 'c']);
  // The route must prove reciprocity before supplying this option.
  const mutualFollowers = await getFollowPage(
    client, ownerA, profiles[1], 'followers', 40, 0, { mutualFollow: true }
  );
  assert.deepEqual(mutualFollowers.users.map((p) => p.username), ['a']);
});

test('full counters do not depend on viewer or counterparty privacy', async () => {
  const { client } = serviceClient();
  assert.deepEqual(await getFollowCounts(client, 'public-a'), { followers: 2, following: 2 });
  assert.deepEqual(await getFollowCounts(client, 'private-b'), { followers: 1, following: 2 });
});

test('page offsets and counts include private participants in public directory', async () => {
  const { client } = serviceClient();
  const first = await getFollowPage(client, visitor, profiles[0], 'followers', 1, 0);
  const second = await getFollowPage(client, visitor, profiles[0], 'followers', 1, 1);
  assert.deepEqual(first.users.map((p) => p.username), ['b']);
  assert.deepEqual(second.users.map((p) => p.username), ['c']);
  assert.equal(first.total, 2);
  assert.equal(second.total, 2);
});

test('empty page does not hydrate profiles; missing or unknown privacy fails closed', async () => {
  const { client, calls } = serviceClient({ rows: [] });
  assert.deepEqual(await getFollowPage(client, null, profiles[0], 'followers', 40, 0), { users: [], total: 0 });
  assert.equal(calls.profiles, 0);
  await assert.rejects(getFollowPage(client, visitor, { id: 'unknown' }, 'followers', 40, 0), /Private follow directory/);
  await assert.rejects(getFollowPage(client, visitor, profiles[0], 'bad-type', 40, 0), /Invalid follow list type/);
});

test('database and hydration errors are not silently ignored', async () => {
  const error = new Error('database failed');
  await assert.rejects(getFollowPage(serviceClient({ followError: error }).client, visitor, profiles[0], 'followers', 40, 0), /database failed/);
  await assert.rejects(getFollowPage(serviceClient({ profileError: error }).client, visitor, profiles[0], 'followers', 40, 0), /database failed/);
  await assert.rejects(getFollowCounts(serviceClient({ followError: error }).client, 'public-a'), /database failed/);
});
