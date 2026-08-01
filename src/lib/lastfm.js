const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';

export async function getLastFmNowPlaying(lastfmUsername) {
  if (!lastfmUsername) return null;

  const url =
    `${LASTFM_API}?method=user.getRecentTracks` +
    `&user=${encodeURIComponent(lastfmUsername)}` +
    `&api_key=${process.env.LASTFM_API_KEY}` +
    `&format=json&limit=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const data = await res.json();
    const track = data?.recenttracks?.track?.[0];
    if (!track) return null;

    const isPlaying = track?.['@attr']?.nowplaying === 'true';

    if (!isPlaying) return null;

    return {
      isPlaying: true,
      title: track.name,
      artist: track.artist?.['#text'] || track.artist || 'Unknown',
      url: track.url || null,
      album: track.album?.['#text'] || null,
      image: track.image?.slice(-1)?.[0]?.['#text'] || null,
    };
  } catch (err) {
    console.error('Last.fm now playing error:', err.message);
    return null;
  }
}

export async function getLastFmUsername(userId) {
  const { createSupabaseServer } = await import('./supabase-server');
  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from('user_connections')
    .select('provider_account_id')
    .eq('user_id', userId)
    .eq('provider', 'lastfm')
    .maybeSingle();

  if (error || !data) return null;
  return data.provider_account_id;
}
