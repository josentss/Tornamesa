import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSpotifyToken } from '@/lib/spotify';

async function searchSpotify(query) {
  let token = await getSpotifyToken();

  const doFetch = async (accessToken) => {
    return fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  };

  let response = await doFetch(token);

  if (response.status === 401) {
    token = await getSpotifyToken(true);
    response = await doFetch(token);
  }

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

  try {
    if (type === 'user') {
      const supabase = createSupabaseServer();
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(10);

      if (error) throw error;
      return NextResponse.json(users);
    }

    const albums = await searchSpotify(q);
    return NextResponse.json(albums);
  } catch (error) {
    console.error('Search error:', error.message);
    return NextResponse.json(
      { error: 'Search temporarily unavailable' },
      { status: 503 }
    );
  }
}
