import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const { userId } = params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = createSupabaseServer();

  try {
    const { data: history, error } = await supabase
      .from('listens')
      .select(`
        id,
        listened_at,
        rating,
        review,
        albums (
          spotify_id,
          title,
          artist,
          cover_url,
          duration_ms
        )
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const totalMinutes =
      (history || []).reduce((acc, item) => acc + (item.albums?.duration_ms || 0), 0) /
      1000 /
      60;

    return NextResponse.json({
      stats: {
        totalAlbumsListened: history?.length || 0,
        totalMinutesSpended: Math.round(totalMinutes),
      },
      history: history || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
