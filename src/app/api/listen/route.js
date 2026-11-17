import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import { getRequestUser, unauthorized } from '@/lib/apiAuth';
import { normalizeTimeZone } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const rl = await rateLimit(clientKey(request, 'listen', authUser.id), {
      limit: 40,
      windowMs: 60_000,
      name: 'listen',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json();
    const { albumId, rating, review, timezone } = body;
    const userId = authUser.id;

    if (!albumId) {
      return NextResponse.json({ error: 'Missing albumId' }, { status: 400 });
    }

    // New listens describe events only. Global ratings/reviews are stored
    // exclusively in public.reviews via the album review endpoints.
    if ((rating != null && rating !== '') ||
        (review != null && String(review).trim() !== '')) {
      return NextResponse.json(
        { error: 'Rate or review the album using the album review editor' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

    const { data: existingAlbum } = await supabase
      .from('albums')
      .select('spotify_id')
      .eq('spotify_id', albumId)
      .maybeSingle();

    if (!existingAlbum) {
      const spotifyResponse = await spotifyFetch(
        `https://api.spotify.com/v1/albums/${albumId}`
      );
      if (!spotifyResponse.ok) {
        return NextResponse.json(
          { error: 'Album not found on Spotify' },
          { status: 404 }
        );
      }
      const albumData = await spotifyResponse.json();
      const totalDuration = (albumData.tracks?.items || []).reduce(
        (acc, t) => acc + (t.duration_ms || 0),
        0
      );
      await supabase.from('albums').upsert(
        {
          spotify_id: albumData.id,
          title: albumData.name,
          artist: albumData.artists?.[0]?.name || 'Unknown',
          cover_url: albumData.images?.[0]?.url || null,
          duration_ms: totalDuration,
        },
        { onConflict: 'spotify_id' }
      );
    }

    // Do not silently overwrite an established profile timezone when the
    // client omits it. The database uses the stored zone for month boundaries.
    const tz = timezone ? normalizeTimeZone(timezone) : null;
    const listenedAt = new Date().toISOString();

    const { data: newListen, error: listenError } = await supabase
      .from('listens')
      .insert([
        {
          user_id: userId,
          album_id: albumId,
          listened_at: listenedAt,
        },
      ])
      .select();

    if (listenError) throw listenError;

    if (tz) {
      const { error: timezoneError } = await supabase
        .from('profiles')
        .update({ timezone: tz })
        .eq('id', userId);
      if (timezoneError) console.warn('save timezone failed:', timezoneError);
    }

    // The SQL trigger marks this user-local month dirty atomically with
    // the insert. The next top/stats read rebuilds once, not on every listen.
    return NextResponse.json(
      {
        success: true,
        message: 'Listen logged',
        data: newListen[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Listen error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
