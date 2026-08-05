import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { username } = params;
  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = profile.id;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth() + 1;

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
      let { data: summary } = await supabase
        .from('monthly_summaries')
        .select('id')
        .eq('user_id', userId)
        .eq('year', nowYear)
        .eq('month', nowMonth)
        .maybeSingle();

      if (!summary) {
        await recomputeMonthlyTop(userId, nowYear, nowMonth);
        const res = await supabase
          .from('monthly_summaries')
          .select('id')
          .eq('user_id', userId)
          .eq('year', nowYear)
          .eq('month', nowMonth)
          .maybeSingle();
        summary = res.data;
      }

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

    // Ratings: reviews + listens
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

    const { data: ratedListens } = await supabase
      .from('listens')
      .select('album_id, rating')
      .eq('user_id', userId)
      .not('rating', 'is', null);

    (ratedListens || []).forEach((l) => {
      if (l.rating >= 1 && l.rating <= 10 && ratingMap[l.album_id] == null) {
        ratingDistribution[l.rating]++;
        ratingMap[l.album_id] = l.rating;
      }
    });

    // Recent activity
    const { data: recentListens, error: recentError } = await supabase
      .from('listens')
      .select(
        'album_id, listened_at, rating, albums(spotify_id, title, artist, cover_url)'
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
            rating: ratingMap[album.spotify_id] ?? item.rating ?? null,
          },
          count: 0,
        };
      }
      grouped[key].count++;
      if (item.rating != null) {
        grouped[key].album.rating = item.rating;
      }
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
        recentActivity,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
