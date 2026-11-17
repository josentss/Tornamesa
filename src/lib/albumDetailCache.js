import { Redis } from '@upstash/redis';

const TTL_SECONDS = 60 * 60; // temporary Spotify metadata only, never permanent
const LIMIT = 100;
const KEY_PREFIX = 'tornamesa:spotify:album-details:v1:';
const memory = new Map();
let redis = null;

function redisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

export async function readCachedAlbumDetails(id) {
  if (!/^[a-zA-Z0-9]{22}$/.test(String(id || ''))) return null;
  const entry = memory.get(id);
  if (entry?.until > Date.now()) return entry.data;
  if (entry) memory.delete(id);

  const client = redisClient();
  if (!client) return null;
  try {
    const value = await client.get(KEY_PREFIX + id);
    if (value && typeof value === 'object' && Array.isArray(value.tracks)) {
      memory.set(id, { data: value, until: Date.now() + 60_000 });
      return value;
    }
  } catch (e) {
    console.warn('Album detail cache read:', e.message);
  }
  return null;
}

export async function storeCachedAlbumDetails(id, details) {
  if (!/^[a-zA-Z0-9]{22}$/.test(String(id || '')) || !details) return;
  memory.set(id, { data: details, until: Date.now() + TTL_SECONDS * 1000 });
  if (memory.size > LIMIT) memory.delete(memory.keys().next().value);

  const client = redisClient();
  if (client) {
    try {
      await client.set(KEY_PREFIX + id, details, { ex: TTL_SECONDS });
    } catch (e) {
      console.warn('Album detail cache write:', e.message);
    }
  }
}
