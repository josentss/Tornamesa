import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';

async function searchSpotify(query) {
  const response = await spotifyFetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=10`
  );

  if (response.status === 429) {
    console.warn('Spotify rate limited');
    return [];
  }

  if (!response.ok) {
    console.error(`Spotify search failed with status ${response.status}`);
    return [];
  }

  const data = await response.json();

  return (data.albums?.items || []).map((album) => ({
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name || 'Unknown',
    coverUrl: album.images?.[0]?.url || null,
    releaseDate: album.release_date || 'N/A',
    spotifyLink: album.external_urls?.spotify || '',
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type') || 'album';

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: 'Search must be at least 2 characters' },
      { status: 400 }
    );
  }

  const albums = await searchSpotify(q);
  return NextResponse.json(albums);
}
