/**
 * Shared search freshness. Local catalog persists basic album metadata;
 * this stamp only says when a query LAST SUCCEEDED against Spotify.
 * No album/track data is stored in Redis by this module.
 */
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

export const SEARCH_FRESH_SECONDS = 6 * 60 * 60;
export const SEARCH_ATTEMPT_SECONDS = 2 * 60;
const NS = 'tornamesa:spotify:search-fresh:v1:';

let redis = null;
const memory = new Map();

export function searchQueryKey(query) {
  const normalized = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

function redisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

function memoryState(key, now) {
  if (memory.size > 2000) {
    for (const [k, v] of memory) {
      if (v.freshUntil <= now && v.attemptUntil <= now) memory.delete(k);
    }
    if (memory.size > 2000) memory.delete(memory.keys().next().value);
  }
  return memory.get(key) || { freshUntil: 0, attemptUntil: 0 };
}

/**
 * Reserve at most one remote search attempt per query in a short window.
 * If the last successful Spotify query was recent, automatic searches skip it
 * regardless of whether Supabase has 0, 2 or 200 matching albums.
 * Every request honors both the freshness window and the attempt throttle.
 */
export async function reserveAlbumSearch(query) {
  const key = searchQueryKey(query);
  const client = redisClient();
  const now = Date.now();

  if (client) {
    const freshKey = NS + key + ':fresh';
    const attemptKey = NS + key + ':attempt';
    try {
      if (Number(await client.exists(freshKey)) > 0) {
        return { fetchRemote: false, reason: 'recently-refreshed' };
      }
      const got = await client.set(attemptKey, '1', {
        nx: true,
        ex: SEARCH_ATTEMPT_SECONDS,
      });
      if (got !== 'OK') return { fetchRemote: false, reason: 'recent-attempt' };
      return { fetchRemote: true, freshKey, client, shared: true };
    } catch (error) {
      // If distributed coordination is configured but broken, fail closed
      // instead of allowing every Vercel instance to stampede Spotify.
      console.warn('Spotify search freshness Redis error:', error.message);
      return { fetchRemote: false, reason: 'coordination-unavailable' };
    }
  }

  // No Redis: best-effort per-instance TTL and attempt cap. Outbound budget
  // is separately enforced by spotifyFetch. Redis remains recommended.
  const state = memoryState(key, now);
  if (state.freshUntil > now) {
    return { fetchRemote: false, reason: 'recently-refreshed' };
  }
  if (state.attemptUntil > now) {
    return { fetchRemote: false, reason: 'recent-attempt' };
  }
  memory.set(key, {
    freshUntil: state.freshUntil,
    attemptUntil: now + SEARCH_ATTEMPT_SECONDS * 1000,
  });
  return { fetchRemote: true, key, shared: false };
}

function safeIds(value) {
  const items = typeof value === 'string'
    ? (() => { try { return JSON.parse(value); } catch { return []; } })()
    : value;
  return Array.isArray(items)
    ? items.filter((id) => /^[A-Za-z0-9]{22}$/.test(id)).slice(0, 10)
    : [];
}

/**
 * The last ordered Spotify match IDs are held temporarily. Rehydrate their
 * display fields from Supabase so cached local pages keep the same result
 * ordering (new releases do not vanish after a refresh).
 */
export async function getRecentAlbumSearchIds(query) {
  const key = searchQueryKey(query);
  const client = redisClient();
  if (client) {
    try {
      return safeIds(await client.get(NS + key + ':ids'));
    } catch (error) {
      console.warn('Spotify search recent IDs Redis read:', error.message);
      return [];
    }
  }
  const state = memoryState(key, Date.now());
  return state.freshUntil > Date.now() ? safeIds(state.ids) : [];
}

export async function confirmAlbumSearchSuccess(reservation, albumIds = []) {
  if (!reservation?.fetchRemote) return;
  if (reservation.shared) {
    try {
      // Write ordered IDs before freshness to avoid readers seeing a fresh
      // stamp without its associated remote search results.
      await reservation.client.set(
        reservation.freshKey.replace(/:fresh$/, ':ids'),
        safeIds(albumIds),
        { ex: SEARCH_FRESH_SECONDS }
      );
      await reservation.client.set(reservation.freshKey, '1', { ex: SEARCH_FRESH_SECONDS });
    } catch (error) {
      console.warn('Spotify search freshness write failed:', error.message);
    }
    return;
  }
  const now = Date.now();
  const state = memoryState(reservation.key, now);
  memory.set(reservation.key, {
    ...state,
    freshUntil: now + SEARCH_FRESH_SECONDS * 1000,
    ids: safeIds(albumIds),
  });
}
