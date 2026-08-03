let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

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
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Spotify token error:', response.status, text);
    throw new Error(`Spotify token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Spotify did not return an access_token');
  }

  return {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 180) * 1000,
  };
}

export async function getSpotifyToken(forceNew = false) {
  if (tokenPromise) {
    return tokenPromise;
  }

  if (!forceNew && cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  tokenPromise = (async () => {
    try {
      const { token, expiry } = await fetchNewToken();
      cachedToken = token;
      tokenExpiry = expiry;
      return token;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

export function clearSpotifyToken() {
  cachedToken = null;
  tokenExpiry = 0;
}

export async function spotifyFetch(url, options = {}) {
  let token = await getSpotifyToken();

  const doFetch = (accessToken) =>
    fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await doFetch(token);

  if (response.status === 401) {
    console.warn('Spotify 401 – refreshing token and retrying');
    clearSpotifyToken();
    token = await getSpotifyToken(true);
    response = await doFetch(token);
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
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.access_token;
}
