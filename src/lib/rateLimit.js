import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const memoryBuckets = new Map();

function memoryPrune(now) {
  if (memoryBuckets.size < 2000) return;
  for (const [key, entry] of memoryBuckets) {
    if (entry.resetAt <= now) memoryBuckets.delete(key);
  }
}

function memoryLimit(key, { limit, windowMs }) {
  const now = Date.now();
  memoryPrune(now);

  let entry = memoryBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, limit - entry.count),
  };
}

let redis = null;
const limiters = new Map();

function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getUpstashLimiter(name, limit, windowMs) {
  const client = getRedis();
  if (!client) return null;

  const cacheKey = `${name}:${limit}:${windowMs}`;
  if (limiters.has(cacheKey)) return limiters.get(cacheKey);

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `tornamesa:rl:${name}`,
    analytics: false,
  });

  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number, name?: string }} opts
 */
export async function rateLimit(
  key,
  { limit = 30, windowMs = 60_000, name = 'default' } = {}
) {
  const upstash = getUpstashLimiter(name, limit, windowMs);

  if (upstash) {
    try {
      const result = await upstash.limit(key);
      if (!result.success) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((result.reset - Date.now()) / 1000)
        );
        return { ok: false, remaining: 0, retryAfterSec };
      }
      return { ok: true, remaining: result.remaining ?? 0 };
    } catch (err) {
      console.warn(
        'Upstash rateLimit failed, using memory fallback:',
        err.message
      );
      return memoryLimit(key, { limit, windowMs });
    }
  }

  return memoryLimit(key, { limit, windowMs });
}

export function clientKey(request, prefix, userId = null) {
  const fwd = request.headers.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : null)?.trim() || 'unknown';
  if (userId) return `${prefix}:u:${userId}`;
  return `${prefix}:ip:${ip}`;
}

export function rateLimitResponse(retryAfterSec = 60) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please slow down.',
      retryAfter: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}
