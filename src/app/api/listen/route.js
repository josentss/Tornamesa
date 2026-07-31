import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSpotifyToken } from '@/lib/spotify';
import { sanitizeString } from '@/lib/validators';

export async function POST(request) {
  const { albumId, userId, rating, review } = await request.json();

  if (!albumId || !userId) {
    return NextResponse.json({ error: 'Faltan albumId o userId' }, { status: 400 });
  }
  if (rating && (rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'Rating debe estar entre 1 y 5' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { data: existingAlbum } = await supabase
      .from('albums')
      .select('spotify_id')
      .eq('spotify_id', albumId)
      .single();

    if (!existingAlbum) {
      const token = await getSpotifyToken();
      const spotifyResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!spotifyResponse.ok) {
        return NextResponse.json({ error: 'Álbum no encontrado en Spotify' }, { status: 404 });
      }

      const albumData = await spotifyResponse.json();
      const totalDuration = albumData.tracks.items.reduce((acc, track) => acc + track.duration_ms, 0);

      await supabase.from('albums').insert([{
        spotify_id: albumData.id,
        title: albumData.name,
        artist: albumData.artists[0]?.name || 'Unknown',
        cover_url: albumData.images[0]?.url || null,
        duration_ms: totalDuration,
      }]);
    }

    const { data: newListen, error: listenError } = await supabase
      .from('listens')
      .insert([{
        user_id: userId,
        album_id: albumId,
        rating: rating || null,
        review: sanitizeString(review),
      }])
      .select();

    if (listenError) throw listenError;

    return NextResponse.json({
      success: true,
      message: 'Escucha registrada',
      data: newListen[0],
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
