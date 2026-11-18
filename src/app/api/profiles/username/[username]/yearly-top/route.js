import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canViewWithFollows } from '@/lib/visibilityAccess';
import { localDateKey, normalizeTimeZone } from '@/lib/timezone';
import { buildYearTopRanges, toTopRpcRanges } from '@/lib/topRanges';
import { clientKey, rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

function toAlbum(row, metadata) {
  const album = metadata[row.album_id];
  return {
    rank: Number(row.rank),
    albumId: row.album_id,
    title: album?.title || 'Unknown album',
    artist: album?.artist || '',
    cover: album?.cover_url || null,
    count: Number(row.listen_count),
    rating: row.rating == null ? null : Number(row.rating),
  };
}

/**
 * Authorized annual view. The service-role RPC is NEVER exposed to the
 * browser and only runs after canViewWithFollows verifies this request.
 * Deliberately no cross-user cache: privacy changes take effect immediately.
 */
export async function GET(request, { params }) {
  try {
    const raw = params?.username;
    if (typeof raw !== 'string' || raw.length < 1 || raw.length > 100) {
      return json({ error: 'User not found' }, 404);
    }

    const { searchParams } = new URL(request.url);
    const requestedYear = searchParams.get('year');
    if (requestedYear !== null && !/^\d{4}$/.test(requestedYear)) {
      return json({ error: 'Invalid year' }, 400);
    }

    const viewer = await getRequestUser(request);
    const supabase = createSupabaseServer();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, timezone')
      .eq('username', raw.toLowerCase())
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return json({ error: 'User not found' }, 404);

    if (!await canViewWithFollows(supabase, viewer, profile, 'top')) {
      return json({ error: 'This top is private' }, 403);
    }

    const tz = normalizeTimeZone(profile.timezone || 'UTC');
    const defaultYear = Number(localDateKey(new Date(), tz).slice(0, 4));
    const year = requestedYear === null ? defaultYear : Number(requestedYear);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return json({ error: 'Invalid year' }, 400);
    }

    const limited = await rateLimit(
      clientKey(request, 'yearly-top', viewer?.id),
      { limit: 30, windowMs: 60_000, name: 'yearly-top' }
    );
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const periods = toTopRpcRanges(buildYearTopRanges(year, tz));
    const common = {
      p_user_id: profile.id,
      p_ranges: periods,
      p_min_listens: 1,
      p_artist: null,
    };

    // Every aggregate is processed in Postgres. Avoid Supabase's 1000-row
    // response cap and never scan all listens through a JS client loop.
    const [top, rated, stats, archive] = await Promise.all([
      supabase.rpc('top_albums', {
        ...common, p_sort: 'listens', p_min_rating: null, p_limit: 50,
      }),
      supabase.rpc('top_albums', {
        ...common, p_sort: 'rating', p_min_rating: 1, p_limit: 5,
      }),
      supabase.rpc('yearly_top_stats', {
        p_user_id: profile.id, p_year: year,
      }),
      supabase.rpc('list_listen_months', { p_user_id: profile.id }),
    ]);

    const failure = [top, rated, stats, archive].find((result) => result.error);
    if (failure) throw failure.error;
    if (!stats.data || typeof stats.data !== 'object') {
      throw new Error('Yearly stats RPC returned an invalid payload');
    }

    const ids = [...new Set([
      ...(top.data || []).map((row) => row.album_id),
      ...(rated.data || []).map((row) => row.album_id),
    ])];
    const metadata = {};
    if (ids.length > 0) {
      const { data: albumRows, error: albumError } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .in('spotify_id', ids);
      if (albumError) throw albumError;
      for (const album of albumRows || []) metadata[album.spotify_id] = album;
    }

    const summary = stats.data;
    const availableYears = [...new Set((archive.data || [])
      .map((row) => Number(row.year))
      .filter((value) => Number.isInteger(value) && value >= 1900 && value <= 2100))]
      .sort((a, b) => b - a);
    if (!availableYears.includes(year)) availableYears.push(year);
    availableYears.sort((a, b) => b - a);

    return json({
      username: profile.username,
      year,
      summary: {
        totalListens: Number(summary.totalListens || 0),
        uniqueAlbums: Number(summary.uniqueAlbums || 0),
        uniqueArtists: Number(summary.uniqueArtists || 0),
        repeatListens: Number(summary.repeatListens || 0),
        discoveries: Number(summary.discoveries || 0),
        ratedAlbums: Number(summary.ratedAlbums || 0),
      },
      monthly: Array.isArray(summary.monthly)
        ? summary.monthly.map((item) => ({
          month: Number(item.month),
          listens: Number(item.listens || 0),
          albums: Number(item.albums || 0),
        }))
        : [],
      topArtists: Array.isArray(summary.topArtists)
        ? summary.topArtists.map((item) => ({
          name: item.name,
          listens: Number(item.listens || 0),
          albums: Number(item.albums || 0),
        }))
        : [],
      albums: (top.data || []).map((row) => toAlbum(row, metadata)),
      bestRated: (rated.data || []).map((row) => toAlbum(row, metadata)),
      availableYears,
    });
  } catch (error) {
    console.error('yearly-top error:', error);
    return json({ error: 'Failed to load yearly top' }, 500);
  }
}
