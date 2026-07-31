import { createSupabaseServer } from './supabase-server';

let spotifyToken = '';
let tokenExpiry = 0;

export async function getSpotifyToken() {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiry) return spotifyToken;

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

  if (!response.ok) throw new Error('Spotify token request failed');

  const data = await response.json();
  spotifyToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

export async function getUserSpotifyToken(userId) {
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
