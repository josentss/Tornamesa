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
 * Manual refresh bypasses freshness, NOT attempt throttling.
 */
export async function reserveAlbumSearch(query, { force = false } = {}) {
  const key = searchQueryKey(query);
  const client = redisClient();
  const now = Date.now();

  if (client) {
    const freshKey = NS + key + ':fresh';
    const attemptKey = NS + key + ':attempt';
    try {
      if (!force && Number(await client.exists(freshKey)) > 0) {
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
  if (!force && state.freshUntil > now) {
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

export async function confirmAlbumSearchSuccess(reservation) {
  if (!reservation?.fetchRemote) return;
  if (reservation.shared) {
    try {
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
  });
}
