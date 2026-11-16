import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/followsVisibility.js', import.meta.url), 'utf8');
const { getVisibleFollowPage, getVisibleFollowCounts } = await import(
  `data:text/javascript,${encodeURIComponent(source)}`
);

const edges = [
  { follower_id: 'private-b', following_id: 'public-a' },
  { follower_id: 'public-c', following_id: 'public-a' },
  { follower_id: 'public-a', following_id: 'public-c' },
  { follower_id: 'public-a', following_id: 'private-b' },
];
const profiles = [
  { id: 'public-a', username: 'a', is_private: false },
  { id: 'private-b', username: 'b', is_private: true },
  { id: 'public-c', username: 'c', is_private: false },
];

function scopedClient(rows, { error = null } = {}) {
  return {
    from(table) {
      assert.equal(table, 'follows');
      return {
        select(column, options) {
          assert.equal(options.count, 'exact');
          return {
            eq(field, id) {
              const matching = rows.filter((edge) => edge[field] === id);
              if (options.head) return Promise.resolve({ count: matching.length, error });
              return {
                order(orderColumn) {
                  return {
                    range(start, end) {
                      const sorted = matching.slice().sort((a, b) =>
                        a[orderColumn].localeCompare(b[orderColumn])
                      );
                      return Promise.resolve({
                        data: sorted.slice(start, end + 1).map((row) => ({ [column]: row[column] })),
                        count: matching.length,
                        error,
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
}

function profileClient(seen, { error = null } = {}) {
  return {
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select(fields) {
          assert.match(fields, /is_private/);
          return {
            in(field, ids) {
              assert.equal(field, 'id');
              seen.push(...ids);
              return Promise.resolve({
                data: profiles.filter((p) => ids.includes(p.id)),
                error,
              });
            },
          };
        },
      };
    },
  };
}

test('visitor pagination and count exclude private follower before OFFSET', async () => {
  // Mimics RLS: only public C follows public A; the hidden private B precedes C.
  const visible = edges.filter((e) => e.follower_id === 'public-c' && e.following_id === 'public-a');
  const seen = [];
  const page = await getVisibleFollowPage(
    scopedClient(visible), profileClient(seen), 'followers', 'public-a', 1, 0
  );
  assert.deepEqual(page.users.map((u) => u.id), ['public-c']);
  assert.equal(page.total, 1);
  assert.deepEqual(seen, ['public-c']);
  const counters = await getVisibleFollowCounts(scopedClient(visible), 'public-a');
  assert.deepEqual(counters, { followers: 1, following: 0 });
});

test('relationship participant can see private follower, unlike unrelated visitor', async () => {
  const visible = edges.filter((e) => e.following_id === 'public-a');
  const seen = [];
  const page = await getVisibleFollowPage(
    scopedClient(visible), profileClient(seen), 'followers', 'public-a', 40, 0
  );
  assert.deepEqual(page.users.map((u) => u.id), ['private-b', 'public-c']);
  assert.equal(page.total, 2);
  assert.deepEqual(seen, ['private-b', 'public-c']);
});

test('following list paginates by the related profile ID, not raw relation count', async () => {
  const visible = edges.filter((e) => e.follower_id === 'public-a');
  const seen = [];
  const first = await getVisibleFollowPage(
    scopedClient(visible), profileClient(seen), 'following', 'public-a', 1, 0
  );
  const second = await getVisibleFollowPage(
    scopedClient(visible), profileClient(seen), 'following', 'public-a', 1, 1
  );
  assert.deepEqual(first.users.map((u) => u.id), ['private-b']);
  assert.deepEqual(second.users.map((u) => u.id), ['public-c']);
  assert.equal(first.total, 2);
  assert.equal(second.total, 2);
});

test('empty authorized set never asks service-role client to hydrate private users', async () => {
  const seen = [];
  const page = await getVisibleFollowPage(
    scopedClient([]), profileClient(seen), 'followers', 'public-a', 40, 0
  );
  assert.deepEqual(page, { users: [], total: 0 });
  assert.deepEqual(seen, []);
});

test('RLS and hydration errors fail closed and invalid relation type is rejected', async () => {
  const error = new Error('denied');
  await assert.rejects(
    getVisibleFollowPage(
      scopedClient(edges, { error }), profileClient([]), 'followers', 'public-a', 40, 0
    ), /denied/
  );
  await assert.rejects(
    getVisibleFollowPage(
      scopedClient(edges), profileClient([], { error }), 'followers', 'public-a', 40, 0
    ), /denied/
  );
  await assert.rejects(getVisibleFollowCounts(scopedClient(edges, { error }), 'public-a'), /denied/);
  await assert.rejects(
    getVisibleFollowPage(scopedClient(edges), profileClient([]), 'unknown', 'public-a', 40, 0),
    /Invalid follow list type/
  );
});
