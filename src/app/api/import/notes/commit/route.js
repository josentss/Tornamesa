import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';
import { buildListenTimestamps } from '@/lib/notesImport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function getUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function ensureAlbum(supabase, albumId) {
  const { data: existing } = await supabase
    .from('albums')
    .select('spotify_id')
    .eq('spotify_id', albumId)
    .maybeSingle();

  if (existing) return true;

  const res = await spotifyFetch(
    `https://api.spotify.com/v1/albums/${albumId}`
  );
  if (!res.ok) return false;
  const albumData = await res.json();
  const totalDuration = (albumData.tracks?.items || []).reduce(
    (acc, t) => acc + (t.duration_ms || 0),
    0
  );

  const { error } = await supabase.from('albums').insert([
    {
      spotify_id: albumData.id,
      title: albumData.name,
      artist: albumData.artists?.[0]?.name || 'Unknown',
      cover_url: albumData.images?.[0]?.url || null,
      duration_ms: totalDuration,
    },
  ]);

  if (error && !String(error.message || '').includes('duplicate')) {
    console.error('ensureAlbum:', error);
    return false;
  }
  return true;
}

export async function POST(request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Provide items to import' },
        { status: 400 }
      );
    }
    if (items.length > 500) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const monthsTouched = new Set();
    let inserted = 0;
    const failures = [];

    for (const item of items) {
      const albumId = item.albumId;
      const count = Math.min(50, Math.max(1, Number(item.count) || 1));
      const year = Number(item.year);
      const month = Number(item.month);
      const lineIndex = Number(item.lineIndex) || 0;

      if (!albumId || !year || month < 1 || month > 12) {
        failures.push({ item, reason: 'invalid_fields' });
        continue;
      }

      const ok = await ensureAlbum(supabase, albumId);
      if (!ok) {
        failures.push({ item, reason: 'album_not_found' });
        continue;
      }

      const timestamps = buildListenTimestamps(
        year,
        month,
        count,
        lineIndex
      );
      const rows = timestamps.map((listened_at) => ({
        user_id: user.id,
        album_id: albumId,
        rating: null,
        review: null,
        listened_at,
      }));

      const { error } = await supabase.from('listens').insert(rows);
      if (error) {
        failures.push({ item, reason: error.message });
        continue;
      }

      inserted += rows.length;
      monthsTouched.add(`${year}-${month}`);
    }

    for (const key of monthsTouched) {
      const [y, m] = key.split('-').map(Number);
      try {
        await recomputeMonthlyTop(user.id, y, m);
      } catch (e) {
        console.warn('recompute after import:', e);
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      failures,
      monthsRecomputed: [...monthsTouched],
    });
  } catch (error) {
    console.error('import commit:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
