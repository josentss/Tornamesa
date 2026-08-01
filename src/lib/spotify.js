let cachedToken = null;
let tokenExpiry = 0;

async function fetchNewToken() {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed with status ${response.status}`);
  }

  const data = await response.json();
  return {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
}

export async function getSpotifyToken(forceNew = false) {
  if (!forceNew && cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const { token, expiry } = await fetchNewToken();
  cachedToken = token;
  tokenExpiry = expiry;
  return token;
}

export async function getUserSpotifyToken(userId) {
  const { createSupabaseServer } = await import('./supabase-server');
  const supabase = createSupabaseServer();

  const { data: connection, error } = await supabase
    .from('user_connections')
    .select('refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'spotify')
    .single();

  if (error || !connection?.refresh_token) return null;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }).toString(),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.access_token;
}
