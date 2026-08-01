import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSpotifyToken } from '@/lib/spotify';

async function searchSpotify(query, retryOnAuthError = true) {
  const token = await getSpotifyToken();
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.ok) {
    const data = await response.json();
    return data.albums.items.map((album) => ({
      id: album.id,
      title: album.name,
      artist: album.artists[0]?.name || 'Unknown',
      coverUrl: album.images[0]?.url || null,
      releaseDate: album.release_date,
      spotifyLink: album.external_urls.spotify,
    }));
  }

  if (response.status === 401 && retryOnAuthError) {
    console.warn('Spotify token expired, forcing new token and retrying...');
    return searchSpotify(query, false);
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 2;
    console.warn(`Spotify rate limited, waiting ${retryAfter}s`);
    await new Promise((resolve) => setTimeout(resolve, Number(retryAfter) * 1000));
    return searchSpotify(query, false);
  }

  throw new Error(`Spotify search failed with status ${response.status}`);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type') || 'album';

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Search must be at least 2 characters' }, { status: 400 });
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
      { error: 'Search temporarily unavailable. Please try again in a moment.' },
      { status: 503 }
    );
  }
}
