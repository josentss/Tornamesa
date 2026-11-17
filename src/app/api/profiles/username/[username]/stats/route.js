import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ensureMonthlyTop } from '@/lib/monthlyTop';
import { normalizeTimeZone, localDateKey, zonedMonthRange, zonedLocalToUtc } from '@/lib/timezone';
import { getRequestUser } from '@/lib/apiAuth';
import { canViewWithFollows } from '@/lib/visibilityAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { username } = params;
  const viewer = await getRequestUser(request);
  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, show_activity, timezone')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!await canViewWithFollows(supabase, viewer, profile, 'stats')) {
      return NextResponse.json({ error: 'This profile is private' }, { status: 403 });
    }

    const userId = profile.id;
    const tz = normalizeTimeZone(profile.timezone || 'UTC');
    const today = localDateKey(new Date(), tz);
    const [nowYear, nowMonth] = today.split('-').map(Number);
    const startOfYear = zonedLocalToUtc(nowYear, 1, 1, 0, 0, 0, tz).toISOString();
    const { start: startOfMonth } = zonedMonthRange(nowYear, nowMonth, tz);

    // Unique albums this year / this month (not total listen rows)
    const [{ data: yearRows }, { data: monthRows }] = await Promise.all([
      supabase
        .from('listens')
        .select('album_id')
        .eq('user_id', userId)
        .gte('listened_at', startOfYear),
      supabase
        .from('listens')
        .select('album_id')
        .eq('user_id', userId)
        .gte('listened_at', startOfMonth),
    ]);

    const yearlyListens = new Set(
      (yearRows || []).map((r) => r.album_id).filter(Boolean)
    ).size;
    const monthlyListens = new Set(
      (monthRows || []).map((r) => r.album_id).filter(Boolean)
    ).size;

    // Monthly top from dedicated table
    let monthlyTop = [];
    try {
      // Rebuild only if missing/dirty: profile stats must not serve stale tops.
      const summary = await ensureMonthlyTop(userId, nowYear, nowMonth);

      if (summary) {
        const { data: entries } = await supabase
          .from('monthly_top_entries')
          .select('rank, album_id, listen_count')
          .eq('summary_id', summary.id)
          .is('week', null)
          .order('rank', { ascending: true })
          .limit(5);

        const ids = (entries || []).map((e) => e.album_id);
        const albumMap = {};

        if (ids.length > 0) {
          const { data: albums } = await supabase
            .from('albums')
            .select('spotify_id, title, artist, cover_url')
            .in('spotify_id', ids);

          (albums || []).forEach((a) => {
            albumMap[a.spotify_id] = a;
          });
        }

        monthlyTop = (entries || []).map((e) => {
          const a = albumMap[e.album_id];
          return {
            id: e.album_id,
            title: a?.title || 'Unknown album',
            artist: a?.artist || '',
            cover: a?.cover_url || null,
            count: e.listen_count,
          };
        });
      }
    } catch (mtErr) {
      console.warn('monthly top from table failed:', mtErr);
      monthlyTop = [];
    }

    // Ratings: exactly one canonical review per user/album
    const ratingDistribution = {};
    for (let i = 1; i <= 10; i++) ratingDistribution[i] = 0;
    const ratingMap = {};

    const { data: userReviews } = await supabase
      .from('reviews')
      .select('album_id, rating')
      .eq('user_id', userId);

    (userReviews || []).forEach((r) => {
      if (r.rating >= 1 && r.rating <= 10) {
        ratingDistribution[r.rating]++;
        ratingMap[r.album_id] = r.rating;
      }
    });

    // Recent activity
    const { data: recentListens, error: recentError } = await supabase
      .from('listens')
      .select(
        'album_id, listened_at, albums(spotify_id, title, artist, cover_url)'
      )
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(50);

    if (recentError) throw recentError;

    const grouped = {};
    (recentListens || []).forEach((item) => {
      if (!item.listened_at) return;
      const day = item.listened_at.split('T')[0];
      const album = item.albums;
      if (!album?.spotify_id) return;

      const key = `${day}_${album.spotify_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: day,
          album: {
            id: album.spotify_id,
            title: album.title,
            artist: album.artist,
            cover: album.cover_url,
            rating: ratingMap[album.spotify_id] ?? null,
          },
          count: 0,
        };
      }
      grouped[key].count++;
    });

    const recentActivity = Object.values(grouped)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    return NextResponse.json(
      {
        yearlyListens,
        monthlyListens,
        monthlyTop,
        ratingDistribution,
        recentActivity: (viewer?.id === userId || profile.show_activity === true) ? recentActivity : [],
        lists: [],
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return NextResponse.json({ error: 'Failed to load profile stats' }, { status: 500 });
  }
}
