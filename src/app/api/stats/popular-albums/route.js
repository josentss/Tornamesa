import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(request) {
  const rl = await rateLimit(clientKey(request, 'popular-albums'), {
    limit: 30,
    windowMs: 60_000,
    name: 'popular-albums',
  });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      48,
      Math.max(1, Number(searchParams.get('limit')) || 24)
    );

    const supabase = createSupabaseServer();
    const { data, error } = await supabase.rpc('popular_albums', {
      lim: limit,
    });

    if (error) {
      console.error('popular_albums:', error);
      return NextResponse.json({ albums: [] });
    }

    const albums = (data || []).map((row) => ({
      id: row.album_id,
      title: row.title,
      artist: row.artist,
      cover: row.cover_url,
      listens: Number(row.listen_count) || 0,
    }));

    const res = NextResponse.json({ albums });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    );
    return res;
  } catch (e) {
    console.error('popular-albums:', e);
    return NextResponse.json({ albums: [] });
  }
}
