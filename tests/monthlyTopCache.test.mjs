import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/monthlyTop.js', import.meta.url), 'utf8');
const moduleSource = source
  .replace("import { createSupabaseServer } from '@/lib/supabase-server';",
    'let activeClient; const createSupabaseServer = () => activeClient; export const setClient = (c) => { activeClient = c; };')
  .replace("import { normalizeTimeZone, monthsFromIsoInZone } from '@/lib/timezone';",
    'const normalizeTimeZone = (v) => v || "UTC"; const monthsFromIsoInZone = () => [];');
const { setClient, ensureMonthlyTop, recomputeMonthlyTop, listMonthsWithActivity } =
  await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

const clean = {
  id: 'summary-1', total_listens: 42, unique_albums: 12, is_dirty: false,
  generated_at: '2026-11-01T00:00:00Z',
};
function fakeDb(existing = clean) {
  const state = { lookups: 0, rebuilds: 0, months: 0 };
  const client = {
    from(table) {
      assert.equal(table, 'monthly_summaries');
      state.lookups++;
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() { return { data: existing, error: null }; },
      };
      return query;
    },
    rpc(name, args) {
      if (name === 'rebuild_monthly_top_atomic') {
        state.rebuilds++;
        assert.deepEqual(args, { p_user_id: 'user-1', p_year: 2026, p_month: 11 });
        return { async single() { return { data: { ...clean, id: 'rebuilt', is_dirty: false }, error: null }; } };
      }
      if (name === 'list_listen_months') {
        state.months++;
        assert.deepEqual(args, { p_user_id: 'user-1' });
        return Promise.resolve({ data: [{ year: 2026, month: 11 }], error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  return { client, state };
}

test('clean current month never recomputes on repeated reads', async () => {
  const db = fakeDb(clean);
  setClient(db.client);
  await ensureMonthlyTop('user-1', 2026, 11);
  await ensureMonthlyTop('user-1', 2026, 11);
  assert.equal(db.state.lookups, 2);
  assert.equal(db.state.rebuilds, 0);
});

test('dirty/missing/explicitly refreshed months rebuild via one SQL RPC', async () => {
  for (const previous of [{ ...clean, is_dirty: true }, null, clean]) {
    const db = fakeDb(previous);
    setClient(db.client);
    const result = await ensureMonthlyTop('user-1', 2026, 11, previous === clean);
    assert.equal(result.id, 'rebuilt');
    assert.equal(db.state.rebuilds, 1);
  }
});

test('out-of-range periods are rejected before database queries', async () => {
  const db = fakeDb();
  setClient(db.client);
  await assert.rejects(recomputeMonthlyTop('user-1', 2026, 0), /Invalid monthly top/);
  await assert.rejects(ensureMonthlyTop('user-1', 2026.5, 11), /Invalid monthly top/);
  assert.equal(db.state.lookups + db.state.rebuilds, 0);
});

test('months are derived from the SQL aggregator, not a capped client list', async () => {
  const db = fakeDb();
  setClient(db.client);
  assert.deepEqual(await listMonthsWithActivity('user-1'), [{ year: 2026, month: 11 }]);
  assert.equal(db.state.months, 1);
});
