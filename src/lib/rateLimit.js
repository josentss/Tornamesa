const buckets = new Map();

function prune(now) {
  if (buckets.size < 2000) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {{ ok: true, remaining: number } | { ok: false, remaining: 0, retryAfterSec: number }}
 */
export function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  prune(now);

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
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
