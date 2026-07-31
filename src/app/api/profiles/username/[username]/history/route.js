import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { data: history, error } = await supabase
      .from('listens')
      .select(`
        id,
        listened_at,
        rating,
        albums (
          spotify_id,
          title,
          artist,
          cover_url
        )
      `)
      .eq('user_id', profile.id)
      .order('listened_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(history || []);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
