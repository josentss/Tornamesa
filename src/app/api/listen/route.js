import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { spotifyFetch } from '@/lib/spotify';
import { sanitizeString } from '@/lib/validators';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import { getRequestUser, unauthorized } from '@/lib/apiAuth';

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
    const { albumId, rating, review } = body;
    const userId = authUser.id;

    if (!albumId) {
      return NextResponse.json({ error: 'Missing albumId' }, { status: 400 });
    }

    if (rating !== undefined && rating !== null && rating !== '') {
      const num = Number(rating);
      if (Number.isNaN(num) || num < 1 || num > 10) {
        return NextResponse.json(
          { error: 'Rating must be between 1 and 10' },
          { status: 400 }
        );
      }
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

    const ratingValue =
      rating !== undefined && rating !== null && rating !== ''
        ? Number(rating)
        : null;

    const listenedAt = new Date().toISOString();

    const { data: newListen, error: listenError } = await supabase
      .from('listens')
      .insert([
        {
          user_id: userId,
          album_id: albumId,
          rating: ratingValue,
          review: review ? sanitizeString(review) : null,
          listened_at: listenedAt,
        },
      ])
      .select();

    if (listenError) throw listenError;

    try {
      const d = new Date(listenedAt);
      await recomputeMonthlyTop(
        userId,
        d.getUTCFullYear(),
        d.getUTCMonth() + 1
      );
    } catch (recomputeErr) {
      console.warn('monthly top recompute failed:', recomputeErr);
    }

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
