import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

async function ensureAlbum(supabase, albumId) {
  const { data: existing } = await supabase
    .from('albums')
    .select('spotify_id')
    .eq('spotify_id', albumId)
    .maybeSingle();

  if (existing) return true;

  const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${albumId}`);
  if (!res.ok) return false;

  const albumData = await res.json();
  const totalDuration = (albumData.tracks?.items || []).reduce(
    (acc, t) => acc + (t.duration_ms || 0),
    0
  );

  await supabase.from('albums').upsert(
    {
      spotify_id: albumData.id,
      title: albumData.name,
      artist: albumData.artists?.[0]?.name || 'Unknown',
      cover_url: albumData.images?.[0]?.url || null,
      duration_ms: totalDuration,
    },
    { onConflict: 'spotify_id' }
  );
  return true;
}

export async function POST(request, { params }) {
  const { listId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const body = await request.json();
    const albumId = body.albumId;
    if (!albumId) {
      return NextResponse.json({ error: 'Missing albumId' }, { status: 400 });
    }

    const supabase = createSupabaseServer();

    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (list.user_id !== authUser.id) return forbidden();

    const ok = await ensureAlbum(supabase, albumId);
    if (!ok) {
      return NextResponse.json(
        { error: 'Album not found on Spotify' },
        { status: 404 }
      );
    }

    const { data: item, error } = await supabase
      .from('list_items')
      .upsert(
        { list_id: listId, album_id: albumId },
        { onConflict: 'list_id,album_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    console.error('POST list item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
