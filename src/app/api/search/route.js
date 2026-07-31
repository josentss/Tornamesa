import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSpotifyToken } from '@/lib/spotify';

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

    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) throw new Error('Spotify search error');

    const data = await response.json();
    const albums = data.albums.items.map((album) => ({
      id: album.id,
      title: album.name,
      artist: album.artists[0]?.name || 'Unknown',
      coverUrl: album.images[0]?.url || null,
      releaseDate: album.release_date,
      spotifyLink: album.external_urls.spotify,
    }));

    return NextResponse.json(albums);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
