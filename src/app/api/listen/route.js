import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { sanitizeString } from '@/lib/validators';

export async function POST(request) {
  const { albumId, userId, rating, review } = await request.json();

  if (!albumId || !userId) {
    return NextResponse.json(
      { error: 'Missing albumId or userId' },
      { status: 400 }
    );
  }

  if (rating !== undefined && rating !== null && rating !== '') {
    const num = Number(rating);
    if (Number.isNaN(num) || num < 1 || num > 10) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 10' },
        { status: 400 }
      );
    }
  }

  const supabase = createSupabaseServer();

  try {
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: existingAlbum } = await supabase
      .from('albums')
      .select('spotify_id')
      .eq('spotify_id', albumId)
      .single();

    if (!existingAlbum) {
      const spotifyResponse = await spotifyFetch(
        `https://api.spotify.com/v1/albums/${albumId}`
      );

      if (!spotifyResponse.ok) {
        return NextResponse.json(
          { error: 'Album not found on Spotify' },
          { status: 404 }
        );
      }

      const albumData = await spotifyResponse.json();
      const totalDuration = (albumData.tracks?.items || []).reduce(
        (acc, t) => acc + (t.duration_ms || 0),
        0
      );

      await supabase.from('albums').insert([
        {
          spotify_id: albumData.id,
          title: albumData.name,
          artist: albumData.artists?.[0]?.name || 'Unknown',
          cover_url: albumData.images?.[0]?.url || null,
          duration_ms: totalDuration,
        },
      ]);
    }

    const ratingValue =
      rating !== undefined && rating !== null && rating !== ''
        ? Number(rating)
        : null;

    const { data: newListen, error: listenError } = await supabase
      .from('listens')
      .insert([
        {
          user_id: userId,
          album_id: albumId,
          rating: ratingValue,
          review: review ? sanitizeString(review) : null,
          listened_at: new Date().toISOString(), // CRÍTICO para stats del perfil
        },
      ])
      .select();

    if (listenError) throw listenError;

    return NextResponse.json(
      {
        success: true,
        message: 'Listen logged',
        data: newListen[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Listen error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
