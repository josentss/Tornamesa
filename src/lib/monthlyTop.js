import { createSupabaseServer } from '@/lib/supabase-server';
import { normalizeTimeZone, monthsFromIsoInZone } from '@/lib/timezone';

const TOP_LIMIT = 500;

function assertPeriod(year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid monthly top period');
  }
}

async function resolveUserTimeZone(supabase, userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeTimeZone(profile?.timezone || 'UTC');
}

/**
 * One service-role RPC performs the entire rebuild in a PostgreSQL transaction.
 * The SQL implementation has a per-user/month advisory lock and no API row cap.
 * Requires migration 20261116_02_monthly_top_atomic.sql.
 */
export async function recomputeMonthlyTop(userId, year, month) {
  assertPeriod(year, month);
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc('rebuild_monthly_top_atomic', {
      p_user_id: userId,
      p_year: year,
      p_month: month,
    })
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error('Monthly top rebuild returned no summary');
  return data;
}

/**
 * Explicit batch rebuild helper for imports and maintenance.
 * Unlike the old implementation, failures are returned instead of swallowed.
 */
export async function recomputeMonthsForDates(userId, isoDates = []) {
  const supabase = createSupabaseServer();
  const tz = await resolveUserTimeZone(supabase, userId);
  const keys = new Set();
  for (const iso of isoDates) {
    for (const { year, month } of monthsFromIsoInZone(iso, tz)) {
      keys.add(`${year}-${month}`);
    }
  }

  const monthsRecomputed = [];
  const monthsFailed = [];
  for (const key of keys) {
    const [year, month] = key.split('-').map(Number);
    try {
      await recomputeMonthlyTop(userId, year, month);
      monthsRecomputed.push(key);
    } catch (error) {
      console.error('Monthly top rebuild after import:', key, error);
      monthsFailed.push(key);
    }
  }
  return { monthsRecomputed, monthsFailed };
}

/**
 * No blanket current-month rebuild on GET: database triggers mark affected
 * summaries as dirty. A missed or failed recompute is repaired on next read.
 */
export async function ensureMonthlyTop(userId, year, month, force = false) {
  assertPeriod(year, month);
  const supabase = createSupabaseServer();
  const { data: existing, error } = await supabase
    .from('monthly_summaries')
    .select('id, year, month, total_listens, unique_albums, generated_at, is_dirty')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;

  if (force || !existing || existing.is_dirty !== false) {
    return recomputeMonthlyTop(userId, year, month);
  }
  return existing;
}

export async function getMonthlyTopPayload(
  userId,
  year,
  month,
  week = null,
  limit = TOP_LIMIT,
  force = false
) {
  assertPeriod(year, month);
  if (week != null && (!Number.isInteger(week) || week < 1 || week > 6)) {
    throw new Error('Invalid week');
  }
  const safeLimit = Number.isInteger(limit) ? Math.min(TOP_LIMIT, Math.max(1, limit)) : TOP_LIMIT;
  const supabase = createSupabaseServer();
  const summary = await ensureMonthlyTop(userId, year, month, force);

  let query = supabase
    .from('monthly_top_entries')
    .select('rank, album_id, listen_count, avg_rating, week')
    .eq('summary_id', summary.id)
    .order('rank', { ascending: true })
    .limit(safeLimit);

  if (week == null) query = query.is('week', null);
  else query = query.eq('week', week);

  const { data: entries, error: entriesError } = await query;
  if (entriesError) throw entriesError;

  const ids = [...new Set((entries || []).map((e) => e.album_id))];
  const albumMap = {};
  if (ids.length > 0) {
    const { data: albums, error: albumError } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .in('spotify_id', ids);
    if (albumError) throw albumError;
    for (const item of albums || []) albumMap[item.spotify_id] = item;
  }

  const { data: weekRows, error: weeksError } = await supabase
    .from('monthly_top_entries')
    .select('week')
    .eq('summary_id', summary.id)
    .not('week', 'is', null);
  if (weeksError) throw weeksError;
  const weeksAvailable = [...new Set((weekRows || []).map((r) => r.week))]
    .filter((w) => w != null)
    .sort((a, b) => a - b);

  const albums = (entries || []).map((e) => {
    const album = albumMap[e.album_id];
    return {
      rank: e.rank,
      albumId: e.album_id,
      title: album?.title || 'Unknown album',
      artist: album?.artist || '',
      cover: album?.cover_url || null,
      count: e.listen_count,
      rating: e.avg_rating,
    };
  });

  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return {
    year,
    month,
    week,
    label: `${names[month - 1]} ${year}`,
    weekLabel: week ? `Week ${week}` : null,
    totalListens: summary.total_listens ?? 0,
    uniqueAlbums: summary.unique_albums ?? 0,
    weeksAvailable,
    albums,
    generatedAt: summary.generated_at || null,
  };
}

/** Full-data-set month discovery; PostgreSQL groups in the user's time zone. */
export async function listMonthsWithActivity(userId) {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .rpc('list_listen_months', { p_user_id: userId });
  if (error) throw error;
  return data || [];
}
