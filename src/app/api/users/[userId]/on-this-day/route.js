import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import {
  normalizeTimeZone,
  localDateKey,
  zonedLocalToUtc,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function nextCivilDay(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

export async function GET(request, { params }) {
  const { userId } = params;

  const authUser = await getRequestUser(request);
  if (!authUser) return unauthorized();
  if (authUser.id !== userId) return forbidden();

  const supabase = createSupabaseServer();

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();

    const tz = normalizeTimeZone(profile?.timezone || 'UTC');
    const todayKey = localDateKey(new Date(), tz);
    if (!todayKey) {
      return NextResponse.json({ date: null, years: [] });
    }

    const [cy, cm, cd] = todayKey.split('-').map(Number);

    const { data: oldest } = await supabase
      .from('listens')
      .select('listened_at')
      .eq('user_id', userId)
      .order('listened_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!oldest?.listened_at) {
      return NextResponse.json(
        { date: todayKey, label: formatLabel(cm, cd), years: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const oldestKey = localDateKey(oldest.listened_at, tz);
    const startYear = oldestKey
      ? Number(oldestKey.slice(0, 4))
      : cy - 5;

    const yearsPayload = [];

    for (let y = cy - 1; y >= startYear; y--) {
      const start = zonedLocalToUtc(y, cm, cd, 0, 0, 0, tz);
      const n = nextCivilDay(y, cm, cd);
      const end = zonedLocalToUtc(n.year, n.month, n.day, 0, 0, 0, tz);

      const { data: rows, error } = await supabase
        .from('listens')
        .select(
          `
          id,
          listened_at,
          rating,
          album_id,
          albums (
            spotify_id,
            title,
            artist,
            cover_url
          )
        `
        )
        .eq('user_id', userId)
        .gte('listened_at', start.toISOString())
        .lt('listened_at', end.toISOString())
        .order('listened_at', { ascending: false });

      if (error) throw error;
      if (!rows?.length) continue;

      const albumIds = [
        ...new Set(
          rows.map((r) => r.albums?.spotify_id || r.album_id).filter(Boolean)
        ),
      ];
      const reviewMap = {};
      if (albumIds.length) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('album_id, rating')
          .eq('user_id', userId)
          .in('album_id', albumIds);
        (reviews || []).forEach((r) => {
          if (r.rating != null) reviewMap[r.album_id] = r.rating;
        });
      }

      const byAlbum = new Map();
      for (const row of rows) {
        const aid = row.albums?.spotify_id || row.album_id;
        if (!aid || byAlbum.has(aid)) continue;
        byAlbum.set(aid, {
          listenId: row.id,
          listened_at: row.listened_at,
          rating: reviewMap[aid] ?? row.rating ?? null,
          album: {
            id: aid,
            title: row.albums?.title || 'Unknown album',
            artist: row.albums?.artist || '',
            cover: row.albums?.cover_url || null,
          },
        });
      }

      yearsPayload.push({
        year: y,
        yearsAgo: cy - y,
        items: [...byAlbum.values()],
      });
    }

    return NextResponse.json(
      {
        date: todayKey,
        label: formatLabel(cm, cd),
        years: yearsPayload,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('on-this-day:', e);
    return NextResponse.json(
      { error: e.message || 'Failed' },
      { status: 500 }
    );
  }
}

function formatLabel(month, day) {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[month - 1]} ${day}`;
}
