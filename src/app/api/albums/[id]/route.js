import { NextResponse } from 'next/server';
import { spotifyFetch, getSpotifyToken } from '@/lib/spotify';

export async function GET(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
  }

  try {
    // Diagnóstico: intentar obtener token primero
    let token;
    try {
      token = await getSpotifyToken(true); // forzamos token nuevo
    } catch (tokenError) {
      console.error('Token error:', tokenError.message);
      return NextResponse.json(
        {
          error: 'Failed to get Spotify token',
          details: tokenError.message,
          hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
          hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
        },
        { status: 503 }
      );
    }

    const albumResponse = await fetch(
      `https://api.spotify.com/v1/albums/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!albumResponse.ok) {
      const errorBody = await albumResponse.text();
      console.error('Spotify album response:', albumResponse.status, errorBody);

      return NextResponse.json(
        {
          error: 'Spotify request failed',
          status: albumResponse.status,
          details: errorBody,
          albumId: id,
        },
        { status: albumResponse.status === 404 ? 404 : 503 }
      );
    }

    const albumData = await albumResponse.json();

    // Genres
    let genres = [];
    const artistId = albumData.artists?.[0]?.id;
    if (artistId) {
      const artistResponse = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (artistResponse.ok) {
        const artistData = await artistResponse.json();
        genres = artistData.genres || [];
      }
    }

    let totalMs = 0;
    const tracks = (albumData.tracks?.items || []).map((track) => {
      totalMs += track.duration_ms || 0;
      const minutes = Math.floor((track.duration_ms || 0) / 60000);
      const seconds = Math.floor(((track.duration_ms || 0) % 60000) / 1000);
      return {
        name: track.name,
        duration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      };
    });

    const totalMinutes = Math.round(totalMs / 60000);

    return NextResponse.json({
      id: albumData.id,
      title: albumData.name,
      artist: albumData.artists?.[0]?.name || 'Unknown',
      genres: genres.slice(0, 4),
      coverUrl: albumData.images?.[0]?.url || null,
      releaseDate: albumData.release_date
        ? albumData.release_date.split('-')[0]
        : 'N/A',
      totalDuration: `${totalMinutes} min`,
      tracks,
      spotifyUrl: albumData.external_urls?.spotify || null,
    });
  } catch (error) {
    console.error('Album route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
