import { createSupabaseServer } from '@/lib/supabase-server';

const TOP_MONTH_LIMIT = 20;
const TOP_WEEK_LIMIT = 10;

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

// week of month: 1 = days 1–7, 2 = 8–14, etc
export function weekOfMonth(isoDate) {
  const day = new Date(isoDate).getUTCDate();
  return Math.ceil(day / 7);
}

function rankAlbums(listens, limit) {
  const map = {};

  for (const row of listens) {
    const id = row.album_id;
    if (!id) continue;
    if (!map[id]) {
      map[id] = {
        album_id: id,
        listen_count: 0,
        ratingSum: 0,
        ratingN: 0,
        lastAt: row.listened_at,
      };
    }
    map[id].listen_count += 1;
    if (row.rating != null) {
      map[id].ratingSum += row.rating;
      map[id].ratingN += 1;
    }
    if (row.listened_at && row.listened_at > map[id].lastAt) {
      map[id].lastAt = row.listened_at;
    }
  }

  return Object.values(map)
    .sort((a, b) => {
      if (b.listen_count !== a.listen_count) return b.listen_count - a.listen_count;
      return (b.lastAt || '').localeCompare(a.lastAt || '');
    })
    .slice(0, limit)
    .map((item, i) => ({
      rank: i + 1,
      album_id: item.album_id,
      listen_count: item.listen_count,
      avg_rating:
        item.ratingN > 0
          ? Math.round((item.ratingSum / item.ratingN) * 100) / 100
          : null,
    }));
}

/**
 * Rebuild monthly_summaries + monthly_top_entries for one user/month.
 * Includes full month (week NULL) and weeks 1–6.
 */
export async function recomputeMonthlyTop(userId, year, month) {
  const supabase = createSupabaseServer();
  const { start, end } = monthRange(year, month);

  const { data: listens, error: listenErr } = await supabase
    .from('listens')
    .select('album_id, rating, listened_at')
    .eq('user_id', userId)
    .gte('listened_at', start)
    .lt('listened_at', end);

  if (listenErr) throw listenErr;

  const all = listens || [];
  const uniqueAlbums = new Set(all.map((l) => l.album_id).filter(Boolean)).size;

  const { data: summary, error: sumErr } = await supabase
    .from('monthly_summaries')
    .upsert(
      {
        user_id: userId,
        year,
        month,
        total_listens: all.length,
        unique_albums: uniqueAlbums,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year,month' }
    )
    .select('id, user_id, year, month, total_listens, unique_albums, generated_at')
    .single();

  if (sumErr) throw sumErr;

  // clear old entries for this summary
  await supabase.from('monthly_top_entries').delete().eq('summary_id', summary.id);

  const rows = [];

  // full month
  rankAlbums(all, TOP_MONTH_LIMIT).forEach((e) => {
    rows.push({
      summary_id: summary.id,
      week: null,
      rank: e.rank,
      album_id: e.album_id,
      listen_count: e.listen_count,
      avg_rating: e.avg_rating,
    });
  });

  // weeks
  for (let w = 1; w <= 6; w++) {
    const weekListens = all.filter((l) => weekOfMonth(l.listened_at) === w);
    if (weekListens.length === 0) continue;
    rankAlbums(weekListens, TOP_WEEK_LIMIT).forEach((e) => {
      rows.push({
        summary_id: summary.id,
        week: w,
        rank: e.rank,
        album_id: e.album_id,
        listen_count: e.listen_count,
        avg_rating: e.avg_rating,
      });
    });
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('monthly_top_entries').insert(rows);
    if (insErr) throw insErr;
  }

  return summary;
}

export async function ensureMonthlyTop(userId, year, month) {
  const supabase = createSupabaseServer();
  const now = new Date();
  const isCurrent =
    year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;

  const { data: existing } = await supabase
    .from('monthly_summaries')
    .select('id, generated_at, total_listens, unique_albums')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (!existing || isCurrent) {
    return recomputeMonthlyTop(userId, year, month);
  }
  return existing;
}

export async function getMonthlyTopPayload(userId, year, month, week = null, limit = 20) {
  const supabase = createSupabaseServer();
  const summary = await ensureMonthlyTop(userId, year, month);

  let query = supabase
    .from('monthly_top_entries')
    .select('rank, album_id, listen_count, avg_rating, week')
    .eq('summary_id', summary.id)
    .order('rank', { ascending: true })
    .limit(limit);

  if (week == null) {
    query = query.is('week', null);
  } else {
    query = query.eq('week', week);
  }

  const { data: entries, error } = await query;
  if (error) throw error;

  const albumIds = [...new Set((entries || []).map((e) => e.album_id))];
  const albumMap = {};

  if (albumIds.length > 0) {
    const { data: albums } = await supabase
      .from('albums')
      .select('spotify_id, title, artist, cover_url')
      .in('spotify_id', albumIds);

    (albums || []).forEach((a) => {
      albumMap[a.spotify_id] = a;
    });
  }

  // Weeks that have data
  const { data: weekRows } = await supabase
    .from('monthly_top_entries')
    .select('week')
    .eq('summary_id', summary.id)
    .not('week', 'is', null);

  const weeksAvailable = [
    ...new Set((weekRows || []).map((r) => r.week).filter((w) => w != null)),
  ].sort((a, b) => a - b);

  const albums = (entries || []).map((e) => {
    const a = albumMap[e.album_id];
    return {
      rank: e.rank,
      albumId: e.album_id,
      title: a?.title || 'Unknown album',
      artist: a?.artist || '',
      cover: a?.cover_url || null,
      count: e.listen_count,
      rating: e.avg_rating,
    };
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return {
    year,
    month,
    week: week ?? null,
    label: `${monthNames[month - 1]} ${year}`,
    weekLabel: week ? `Week ${week}` : null,
    totalListens: summary.total_listens ?? 0,
    uniqueAlbums: summary.unique_albums ?? 0,
    weeksAvailable,
    albums,
    generatedAt: summary.generated_at || null,
  };
}

export async function listMonthsWithActivity(userId) {
  const supabase = createSupabaseServer();

  const { data: summaries } = await supabase
    .from('monthly_summaries')
    .select('year, month, total_listens, unique_albums')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (summaries?.length) return summaries;

  const { data: listens } = await supabase
    .from('listens')
    .select('listened_at')
    .eq('user_id', userId)
    .order('listened_at', { ascending: false })
    .limit(2000);

  const set = new Map();
  (listens || []).forEach((l) => {
    if (!l.listened_at) return;
    const d = new Date(l.listened_at);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = `${y}-${m}`;
    if (!set.has(key)) set.set(key, { year: y, month: m });
  });

  return [...set.values()].sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month
  );
}
