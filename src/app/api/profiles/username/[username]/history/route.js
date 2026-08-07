import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    const { data: base, error: baseError } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { data: privacy } = await supabase
      .from('profiles')
      .select('is_private, diary_public')
      .eq('id', base.id)
      .maybeSingle();

    const isOwner = !!(currentUserId && currentUserId === base.id);
    const isPrivate = privacy?.is_private === true;
    const diaryClosed = privacy?.diary_public === false;

    if (!isOwner && (isPrivate || diaryClosed)) {
      return NextResponse.json(
        { error: 'This diary is private' },
        { status: 403, headers: noStoreHeaders }
      );
    }

    const { data: history, error } = await supabase
      .from('listens')
      .select(
        `
        id,
        listened_at,
        rating,
        review,
        albums (
          spotify_id,
          title,
          artist,
          cover_url
        )
      `
      )
      .eq('user_id', base.id)
      .order('listened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json(
      {
        username: base.username,
        history: history || [],
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('GET history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load diary' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
