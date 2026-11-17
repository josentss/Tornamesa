import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20261117_01_canonical_album_review.sql');
const editApi = read('../src/app/api/listen/[id]/route.js');
const listensApi = read('../src/app/api/listen/route.js');
const topSql = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.rebuild_monthly_top_atomic('));

test('canonical update RPC is service-role-only and checks listen owner', () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /WHERE l.id = p_listen_id AND l.user_id = p_user_id/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public.update_listen_and_album_review/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /TO service_role/);
  assert.match(editApi, /existing.user_id !== authUser.id/);
  assert.match(editApi, /body.ratingScope !== 'album'/);
});

test('album review and date use one transactional RPC', () => {
  assert.match(editApi, /rpc\('update_listen_and_album_review'/);
  assert.match(migration, /UPDATE public.listens AS l/);
  assert.match(migration, /INSERT INTO public.reviews AS r/);
  assert.match(migration, /ON CONFLICT \(user_id, album_id\)/);
});

test('monthly ranking relies on canonical review, not per-log average', () => {
  assert.match(topSql, /rv.rating::numeric/);
  assert.doesNotMatch(topSql, /listen_avg/);
  assert.match(migration, /UPDATE public.monthly_summaries SET is_dirty = true/);
});

test('new listens reject per-listen ratings and review text', () => {
  assert.match(listensApi, /Rate or review the album using the album review editor/);
  assert.doesNotMatch(listensApi, /rating: ratingValue/);
});
