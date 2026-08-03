import { NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

export async function GET(request, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
  }

  try {
    const albumResponse = await spotifyFetch(
      `https://api.spotify.com/v1/albums/${id}`
    );

    if (albumResponse.status === 404) {
      return NextResponse.json(
        { error: 'Album not found on Spotify' },
        { status: 404 }
      );
    }

    if (albumResponse.status === 401) {
      const body = await albumResponse.text();
      console.error('Spotify still 401 after retry:', body);
      return NextResponse.json(
        { error: 'Spotify authentication failed' },
        { status: 503 }
      );
    }

    if (!albumResponse.ok) {
      const body = await albumResponse.text();
      console.error('Spotify album error:', albumResponse.status, body);
      return NextResponse.json(
        { error: 'Failed to fetch album from Spotify' },
        { status: 503 }
      );
    }

    const albumData = await albumResponse.json();

    let genres = [];
    const artistId = albumData.artists?.[0]?.id;

    if (artistId) {
      const artistResponse = await spotifyFetch(
        `https://api.spotify.com/v1/artists/${artistId}`
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
