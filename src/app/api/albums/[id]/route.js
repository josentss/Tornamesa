import { NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify';

export async function GET(request, { params }) {
  const { id } = params;

  try {
    const token = await getSpotifyToken();

    const albumResponse = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!albumResponse.ok) {
      return NextResponse.json({ error: 'Álbum no encontrado en Spotify' }, { status: 404 });
    }

    const albumData = await albumResponse.json();

    let genres = [];
    const artistId = albumData.artists[0]?.id;
    if (artistId) {
      const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (artistResponse.ok) {
        const artistData = await artistResponse.json();
        genres = artistData.genres || [];
      }
    }

    let totalMs = 0;
    const tracks = albumData.tracks.items.map((track) => {
      totalMs += track.duration_ms;
      const minutes = Math.floor(track.duration_ms / 60000);
      const seconds = ((track.duration_ms % 60000) / 1000).toFixed(0);
      return {
        name: track.name,
        duration: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`,
      };
    });

    const totalMinutes = Math.round(totalMs / 60000);

    return NextResponse.json({
      id: albumData.id,
      title: albumData.name,
      artist: albumData.artists[0]?.name || 'Unknown',
      genres: genres.slice(0, 4),
      coverUrl: albumData.images[0]?.url || null,
      releaseDate: albumData.release_date ? albumData.release_date.split('-')[0] : 'N/A',
      totalDuration: `${totalMinutes} min`,
      tracks,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
