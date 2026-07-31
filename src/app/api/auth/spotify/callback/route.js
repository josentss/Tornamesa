import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');
  const error = searchParams.get('error');
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(`${frontendUrl}/settings?error=access_denied`);
  }
  if (!userId) {
    return new NextResponse('Error: Usuario no identificado', { status: 400 });
  }

  try {
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
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) throw new Error('Error al intercambiar el código');

    const data = await response.json();

    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const spotifyUserData = await userResponse.json();

    const supabase = createSupabaseServer();
    const { error: dbError } = await supabase
      .from('user_connections')
      .upsert({
        user_id: userId,
        provider: 'spotify',
        provider_account_id: spotifyUserData.id,
        refresh_token: data.refresh_token,
      }, { onConflict: 'user_id,provider' });

    if (dbError) throw dbError;

    return NextResponse.redirect(`${frontendUrl}/settings?connection=success`);
  } catch (err) {
    console.error('Error Spotify callback:', err.message);
    return NextResponse.redirect(`${frontendUrl}/settings?error=spotify_auth_failed`);
  }
}
