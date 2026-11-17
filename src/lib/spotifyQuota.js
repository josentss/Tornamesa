/**
 * Conservative, configurable app-wide Spotify request gate.
 *
 * With Upstash configured, the budget and cooldown are shared between all
 * Vercel instances. Without Upstash, they degrade to best-effort per instance;
 * remote import search is separately disabled without Upstash.
 *
 * This does not claim to know Spotify's actual account quota.
 */
import { Redis } from '@upstash/redis';
import { rateLimit } from '@/lib/rateLimit';

const COOLDOWN_KEY = 'tornamesa:spotify:cooldown-v1';
let instanceCooldownUntil = 0;
let redis;

export function spotifySharedQuotaConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedis() {
  if (!spotifySharedQuotaConfigured()) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export function retryAfterSeconds(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const date = Date.parse(String(value || ''));
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : null;
}

export function isQuotaExceeded(body) {
  return body?.error?.reason === 'QUOTA_EXCEEDED' || body?.reason === 'QUOTA_EXCEEDED';
}

function clamp(seconds) {
  return Math.max(1, Math.min(86400, Math.ceil(Number(seconds) || 1)));
}

export async function readSpotifyCooldown() {
  const now = Date.now();
  if (instanceCooldownUntil > now) {
    return Math.ceil((instanceCooldownUntil - now) / 1000);
  }
  const client = getRedis();
  if (client) {
    try {
      const until = Number(await client.get(COOLDOWN_KEY)) || 0;
      if (until > now) {
        instanceCooldownUntil = until;
        return Math.ceil((until - now) / 1000);
      }
    } catch (e) {
      console.warn('Spotify cooldown Redis read:', e.message);
    }
  }
  return 0;
}

export async function holdSpotifyRequests(seconds) {
  const ttl = clamp(seconds);
  const until = Date.now() + ttl * 1000;
  instanceCooldownUntil = Math.max(instanceCooldownUntil, until);
  const client = getRedis();
  if (client) {
    try {
      const existing = Number(await client.get(COOLDOWN_KEY)) || 0;
      const target = Math.max(existing, until);
      await client.set(COOLDOWN_KEY, target, { ex: Math.max(1, Math.ceil((target - Date.now()) / 1000)) });
    } catch (e) {
      console.warn('Spotify cooldown Redis write:', e.message);
    }
  }
}

export async function reserveSpotifyRequest() {
  const paused = await readSpotifyCooldown();
  if (paused) return { allowed: false, retryAfter: paused, reason: 'COOLDOWN' };

  const requested = Number(process.env.SPOTIFY_CALLS_PER_30S);
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(12, Math.max(1, Math.floor(requested)))
    : 5;
  const result = await rateLimit('spotify:shared-outbound', {
    limit,
    windowMs: 30000,
    name: 'spotify-outbound-v1',
  });
  return result.ok
    ? { allowed: true }
    : { allowed: false, retryAfter: result.retryAfterSec || 30, reason: 'LOCAL_BUDGET' };
}

export async function recordSpotify429(response) {
  const body = await response.clone().json().catch(() => null);
  const quotaExceeded = isQuotaExceeded(body);
  const retry = retryAfterSeconds(response.headers.get('Retry-After'));
  const seconds = clamp(retry ?? (quotaExceeded ? 1800 : 90));
  await holdSpotifyRequests(seconds);
  return { quotaExceeded, retryAfter: seconds };
}
