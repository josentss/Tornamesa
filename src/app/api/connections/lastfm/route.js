import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const { lastfmUsername } = await request.json();
    if (!lastfmUsername?.trim()) {
      return NextResponse.json(
        { error: 'lastfmUsername is required' },
        { status: 400 }
      );
    }

    const username = lastfmUsername.trim().toLowerCase();
    const checkUrl =
      `https://ws.audioscrobbler.com/2.0/?method=user.getInfo` +
      `&user=${encodeURIComponent(username)}` +
      `&api_key=${process.env.LASTFM_API_KEY}&format=json`;

    const checkRes = await fetch(checkUrl);
    const checkData = await checkRes.json();
    if (checkData?.error) {
      return NextResponse.json(
        { error: 'Last.fm user not found' },
        { status: 404 }
      );
    }

    const supabase = createSupabaseServer();
    const { error } = await supabase.from('user_connections').upsert(
      {
        user_id: authUser.id,
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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const supabase = createSupabaseServer();
    const { error } = await supabase
      .from('user_connections')
      .delete()
      .eq('user_id', authUser.id)
      .eq('provider', 'lastfm');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
