import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id: albumId } = params;

  if (!albumId) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
  }

  try {
    const user = await getRequestUser(request);
    if (!user) return unauthorized();

    const rl = await rateLimit(clientKey(request, 'review', user.id), {
      limit: 30,
      windowMs: 60_000,
      name: 'review',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json();
    const { rating, review_text } = body;
    const numericRating = Number(rating);

    if (!rating || Number.isNaN(numericRating) || numericRating < 1 || numericRating > 10) {
      return NextResponse.json(
        { error: 'Invalid rating (1-10)' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('album_id', albumId)
      .maybeSingle();

    let review;

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('reviews')
        .update({
          rating: numericRating,
          review_text: review_text || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) throw updateError;
      review = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          album_id: albumId,
          rating: numericRating,
          review_text: review_text || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      review = inserted;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
        user: {
          id: user.id,
          username: profile?.username ?? 'unknown',
          avatarUrl: profile?.avatar_url ?? null,
        },
      },
    });
  } catch (err) {
    console.error('POST review error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not save review' },
      { status: 500 }
    );
  }
}
