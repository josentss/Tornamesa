import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import {
  normalizeTimeZone,
  zonedMonthRange,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function monthAlbumMap(supabase, userId, year, month, tz) {
  const { start, end } = zonedMonthRange(year, month, tz);
  const { data, error } = await supabase
    .from('listens')
    .select(
      `
      album_id,
      listened_at,
      albums ( spotify_id, title, artist, cover_url )
    `
    )
    .eq('user_id', userId)
    .gte('listened_at', start.toISOString())
    .lt('listened_at', end.toISOString());

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    const id = row.albums?.spotify_id || row.album_id;
    if (!id) continue;
    if (!map[id]) {
      map[id] = {
        album_id: id,
        title: row.albums?.title || 'Unknown',
        artist: row.albums?.artist || '',
        cover: row.albums?.cover_url || null,
        count: 0,
      };
    }
    map[id].count += 1;
  }
  return map;
}

async function ratingMap(supabase, userId, albumIds) {
  const out = {};
  if (!albumIds.length) return out;
  for (let i = 0; i < albumIds.length; i += 200) {
    const chunk = albumIds.slice(i, i + 200);
    const { data } = await supabase
      .from('reviews')
      .select('album_id, rating')
      .eq('user_id', userId)
      .in('album_id', chunk);
    (data || []).forEach((r) => {
      if (r.rating != null) out[r.album_id] = Number(r.rating);
    });
  }
  return out;
}

export async function GET(request, { params }) {
  const { userId } = params;

  const authUser = await getRequestUser(request);
  if (!authUser) return unauthorized();
  if (authUser.id !== userId) return forbidden();

  const rl = await rateLimit(clientKey(request, 'compare', authUser.id), {
    limit: 20,
    windowMs: 60_000,
    name: 'compare',
  });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const withUsername = (searchParams.get('with') || '').trim();
  const now = new Date();
  const year = parseInt(searchParams.get('year') || now.getUTCFullYear(), 10);
  const month = parseInt(
    searchParams.get('month') || now.getUTCMonth() + 1,
    10
  );

  if (!withUsername) {
    return NextResponse.json({ error: 'Missing with=username' }, { status: 400 });
  }
  if (month < 1 || month > 12 || Number.isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    const { data: me } = await supabase
      .from('profiles')
      .select('id, username, timezone')
      .eq('id', userId)
      .maybeSingle();

    const { data: other } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_private, timezone')
      .ilike('username', withUsername)
      .maybeSingle();

    if (!other) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (other.id === userId) {
      return NextResponse.json(
        { error: 'Cannot compare with yourself' },
        { status: 400 }
      );
    }

    const { data: follow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', userId)
      .eq('following_id', other.id)
      .maybeSingle();

    if (!follow) {
      return NextResponse.json(
        { error: 'You can only compare with people you follow' },
        { status: 403 }
      );
    }

    const tzMe = normalizeTimeZone(me?.timezone || 'UTC');
    const tzThem = normalizeTimeZone(other.timezone || 'UTC');

    const [mine, theirs] = await Promise.all([
      monthAlbumMap(supabase, userId, year, month, tzMe),
      monthAlbumMap(supabase, other.id, year, month, tzThem),
    ]);

    const myIds = Object.keys(mine);
    const theirIds = Object.keys(theirs);
    const commonIds = myIds.filter((id) => theirs[id]);
    const onlyMeIds = myIds.filter((id) => !theirs[id]);
    const onlyThemIds = theirIds.filter((id) => !mine[id]);

    const allForRatings = [...new Set([...commonIds, ...myIds, ...theirIds])];
    const [myRatings, theirRatings] = await Promise.all([
      ratingMap(supabase, userId, allForRatings),
      ratingMap(supabase, other.id, allForRatings),
    ]);

    const common = commonIds
      .map((id) => ({
        album_id: id,
        title: mine[id].title,
        artist: mine[id].artist,
        cover: mine[id].cover || theirs[id].cover,
        you_plays: mine[id].count,
        them_plays: theirs[id].count,
        you_rating: myRatings[id] ?? null,
        them_rating: theirRatings[id] ?? null,
      }))
      .sort(
        (a, b) =>
          b.you_plays + b.them_plays - (a.you_plays + a.them_plays)
      );

    const bothRated = common.filter(
      (c) => c.you_rating != null && c.them_rating != null
    );

    const union = new Set([...myIds, ...theirIds]).size;
    const affinity =
      union === 0 ? 0 : Math.round((commonIds.length / union) * 100);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return NextResponse.json(
      {
        period: {
          year,
          month,
          label: `${monthNames[month - 1]} ${year}`,
        },
        you: {
          id: userId,
          username: me?.username,
        },
        them: {
          id: other.id,
          username: other.username,
          full_name: other.full_name,
          avatar_url: other.avatar_url,
        },
        stats: {
          you_albums: myIds.length,
          them_albums: theirIds.length,
          common: commonIds.length,
          only_you: onlyMeIds.length,
          only_them: onlyThemIds.length,
          affinity_percent: affinity,
          both_rated: bothRated.length,
        },
        common,
        both_rated: bothRated
          .map((c) => ({
            ...c,
            rating_diff: c.you_rating - c.them_rating,
          }))
          .sort(
            (a, b) =>
              Math.abs(b.rating_diff) - Math.abs(a.rating_diff)
          ),
        only_you: onlyMeIds.slice(0, 12).map((id) => ({
          album_id: id,
          title: mine[id].title,
          artist: mine[id].artist,
          cover: mine[id].cover,
          plays: mine[id].count,
          rating: myRatings[id] ?? null,
        })),
        only_them: onlyThemIds.slice(0, 12).map((id) => ({
          album_id: id,
          title: theirs[id].title,
          artist: theirs[id].artist,
          cover: theirs[id].cover,
          plays: theirs[id].count,
          rating: theirRatings[id] ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('compare:', e);
    return NextResponse.json(
      { error: e.message || 'Compare failed' },
      { status: 500 }
    );
  }
}
