import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const currentUserId = searchParams.get('currentUserId');

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, diary_public, is_private')
      .ilike('username', username)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = !!(currentUserId && currentUserId === profile.id);

    // Only block when flags are explicitly restrictive (null/undefined = open)
    const diaryClosed = profile.diary_public === false;
    const profilePrivate = profile.is_private === true;

    if (!isOwner && (profilePrivate || diaryClosed)) {
      return NextResponse.json(
        { error: 'This diary is private' },
        { status: 403 }
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
      .eq('user_id', profile.id)
      .order('listened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      username: profile.username,
      history: history || [],
    });
  } catch (error) {
    console.error('GET history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load diary' },
      { status: 500 }
    );
  }
}
