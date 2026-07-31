import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Se requiere el ID del usuario' }, { status: 400 });
  }

  const scope = 'user-read-private user-read-email user-read-currently-playing user-top-read';
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  const authUrl =
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: redirectUri,
      state: userId,
    }).toString();

  return NextResponse.redirect(authUrl);
}
