import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureAlbum(supabase, albumId) {
  const { data: existing } = await supabase
    .from('albums')
    .select('spotify_id, title, artist, cover_url')
    .eq('spotify_id', albumId)
    .single();

  if (existing) return existing;

  try {
    const res = await spotifyFetch(`https://api.spotify.com/v1/albums/${albumId}`);
    if (!res.ok) return null;
    const albumData = await res.json();
    const totalDuration = (albumData.tracks?.items || []).reduce(
      (acc, t) => acc + (t.duration_ms || 0),
      0
    );
    const row = {
      spotify_id: albumData.id,
      title: albumData.name,
      artist: albumData.artists?.[0]?.name || 'Unknown',
      cover_url: albumData.images?.[0]?.url || null,
      duration_ms: totalDuration,
    };
    await supabase.from('albums').upsert([row], { onConflict: 'spotify_id' });
    return {
      spotify_id: row.spotify_id,
      title: row.title,
      artist: row.artist,
      cover_url: row.cover_url,
    };
  } catch (e) {
    console.error('ensureAlbum failed:', albumId, e);
    return null;
  }
}

export async function GET(request, { params }) {
  const { listId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id, user_id, name, description, is_system, created_at, updated_at')
      .eq('id', listId)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', list.user_id)
      .single();

    const { data: items, error: itemsError } = await supabase
      .from('list_items')
      .select('id, album_id, added_at')
      .eq('list_id', listId)
      .order('added_at', { ascending: false });

    if (itemsError) throw itemsError;

    const albumIds = [...new Set((items || []).map((i) => i.album_id))];
    const albumMap = {};

    if (albumIds.length > 0) {
      const { data: albums } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .in('spotify_id', albumIds);

      (albums || []).forEach((a) => {
        albumMap[a.spotify_id] = a;
      });

      for (const id of albumIds) {
        if (!albumMap[id]) {
          const fetched = await ensureAlbum(supabase, id);
          if (fetched) albumMap[id] = fetched;
        }
      }
    }

    const albums = (items || []).map((item) => {
      const album = albumMap[item.album_id];
      return {
        itemId: item.id,
        addedAt: item.added_at,
        album: {
          id: album?.spotify_id || item.album_id,
          title: album?.title || 'Unknown album',
          artist: album?.artist || '',
          cover: album?.cover_url || null,
        },
      };
    });

    return NextResponse.json(
      {
        list: {
          id: list.id,
          userId: list.user_id,
          username: profile?.username || null,
          name: list.name,
          description: list.description,
          isSystem: list.is_system,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
          count: albums.length,
        },
        albums,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
