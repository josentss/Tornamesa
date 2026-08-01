import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// POST { userId, lastfmUsername }
export async function POST(request) {
  const { userId, lastfmUsername } = await request.json();

  if (!userId || !lastfmUsername?.trim()) {
    return NextResponse.json(
      { error: 'userId y lastfmUsername son obligatorios' },
      { status: 400 }
    );
  }

  const username = lastfmUsername.trim().toLowerCase();

  // validar que el usuario existe en Last.fm
  const checkUrl =
    `https://ws.audioscrobbler.com/2.0/?method=user.getInfo` +
    `&user=${encodeURIComponent(username)}` +
    `&api_key=${process.env.LASTFM_API_KEY}&format=json`;

  const checkRes = await fetch(checkUrl);
  const checkData = await checkRes.json();
  if (checkData?.error) {
    return NextResponse.json(
      { error: 'Usuario de Last.fm no encontrado' },
      { status: 404 }
    );
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.from('user_connections').upsert(
    {
      user_id: userId,
      provider: 'lastfm',
      provider_account_id: username,
      refresh_token: null,
    },
    { onConflict: 'user_id,provider' }
  );

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, username });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'lastfm');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
