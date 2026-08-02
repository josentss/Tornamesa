let cachedToken = null;
let tokenExpiry = 0;

async function fetchNewToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Spotify token error:', response.status, text);
    throw new Error(`Spotify token request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    token: data.access_token,
    // renovamos 2 minutos antes de que expire
    expiry: Date.now() + (data.expires_in - 120) * 1000,
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

/**
 * Helper genérico: hace una petición a Spotify y reintenta 1 vez si recibe 401
 */
export async function spotifyFetch(url, options = {}) {
  let token = await getSpotifyToken();

  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  // Token caducado → forzamos uno nuevo y reintentamos
  if (response.status === 401) {
    token = await getSpotifyToken(true);
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return response;
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
