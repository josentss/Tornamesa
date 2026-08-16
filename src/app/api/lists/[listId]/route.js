import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureAlbum(supabase, albumId) {
  const { data: existing } = await supabase
    .from('albums')
    .select('spotify_id, title, artist, cover_url')
    .eq('spotify_id', albumId)
    .maybeSingle();
  if (existing) return existing;
  try {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${albumId}`
    );
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
      .select(
        'id, user_id, name, description, is_system, created_at, updated_at'
      )
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

export async function PATCH(request, { params }) {
  const { listId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const body = await request.json();
    const supabase = createSupabaseServer();

    const { data: list } = await supabase
      .from('lists')
      .select('id, user_id, is_system, name')
      .eq('id', listId)
      .single();

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (list.user_id !== authUser.id) return forbidden();

    const updates = { updated_at: new Date().toISOString() };

    if (body.description !== undefined) {
      updates.description = (body.description || '').trim() || null;
    }

    if (body.name !== undefined) {
      if (list.is_system) {
        return NextResponse.json(
          { error: 'Cannot rename system list' },
          { status: 400 }
        );
      }
      const name = (body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      if (name.toLowerCase() === 'to listen') {
        return NextResponse.json(
          { error: 'This name is reserved' },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    const { data: updated, error } = await supabase
      .from('lists')
      .update(updates)
      .eq('id', listId)
      .select('id, name, description, is_system, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      list: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isSystem: updated.is_system,
        updatedAt: updated.updated_at,
      },
    });
  } catch (err) {
    console.error('PATCH list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { listId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const supabase = createSupabaseServer();

    const { data: list } = await supabase
      .from('lists')
      .select('id, user_id, is_system')
      .eq('id', listId)
      .single();

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (list.user_id !== authUser.id) return forbidden();
    if (list.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system list' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
