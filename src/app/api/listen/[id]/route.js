import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeString } from '@/lib/validators';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function PATCH(request, { params }) {
  const { id } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const rl = await rateLimit(clientKey(request, 'listen-edit', authUser.id), {
      limit: 40,
      windowMs: 60_000,
      name: 'listen-edit',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json();
    const supabase = createSupabaseServer();

    const { data: existing, error: fetchErr } = await supabase
      .from('listens')
      .select('id, user_id, listened_at, rating, review, album_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json(
        { error: 'Listen not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }
    if (existing.user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: noStoreHeaders }
      );
    }

    const fields = {};
    const oldDate = existing.listened_at
      ? new Date(existing.listened_at)
      : null;

    if (body.listened_at != null && body.listened_at !== '') {
      let iso = String(body.listened_at).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        iso = `${iso}T12:00:00.000Z`;
      }
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date' },
          { status: 400, headers: noStoreHeaders }
        );
      }
      fields.listened_at = d.toISOString();
    }

    let ratingTouched = false;
    let ratingValue = undefined;
    if (body.rating !== undefined) {
      ratingTouched = true;
      if (body.rating === null || body.rating === '') {
        fields.rating = null;
        ratingValue = null;
      } else {
        const num = Number(body.rating);
        if (Number.isNaN(num) || num < 1 || num > 10) {
          return NextResponse.json(
            { error: 'Rating must be between 1 and 10' },
            { status: 400, headers: noStoreHeaders }
          );
        }
        fields.rating = num;
        ratingValue = num;
      }
    }

    let reviewTouched = false;
    let reviewValue = undefined;
    if (body.review !== undefined) {
      reviewTouched = true;
      reviewValue =
        body.review && String(body.review).trim()
          ? sanitizeString(String(body.review).trim())
          : null;
      fields.review = reviewValue;
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from('listens')
      .update(fields)
      .eq('id', id)
      .select(
        `
        id,
        listened_at,
        rating,
        review,
        album_id,
        albums ( spotify_id, title, artist, cover_url )
      `
      )
      .single();

    if (updateErr) throw updateErr;

    const albumId = existing.album_id;
    if (albumId && (ratingTouched || reviewTouched)) {
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id, rating, review_text')
        .eq('user_id', authUser.id)
        .eq('album_id', albumId)
        .maybeSingle();

      const finalRating = ratingTouched
        ? ratingValue
        : existingReview?.rating ?? existing.rating ?? null;
      const finalReviewText = reviewTouched
        ? reviewValue
        : existingReview?.review_text ?? existing.review ?? null;

      if (finalRating != null && finalRating >= 1 && finalRating <= 10) {
        if (existingReview) {
          await supabase
            .from('reviews')
            .update({
              rating: finalRating,
              review_text: finalReviewText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingReview.id);
        } else {
          await supabase.from('reviews').insert({
            user_id: authUser.id,
            album_id: albumId,
            rating: finalRating,
            review_text: finalReviewText,
          });
        }
      } else if (ratingTouched && ratingValue === null && existingReview) {
        await supabase.from('reviews').delete().eq('id', existingReview.id);
      }
    }

    try {
      const newDate = new Date(updated.listened_at);
      const months = new Set();
      if (oldDate) {
        months.add(`${oldDate.getUTCFullYear()}-${oldDate.getUTCMonth() + 1}`);
      }
      months.add(`${newDate.getUTCFullYear()}-${newDate.getUTCMonth() + 1}`);
      for (const key of months) {
        const [y, m] = key.split('-').map(Number);
        await recomputeMonthlyTop(authUser.id, y, m);
      }
    } catch (e) {
      console.warn('monthly top recompute on edit:', e);
    }

    return NextResponse.json(
      { success: true, data: updated },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('PATCH listen:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update listen' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const rl = await rateLimit(clientKey(request, 'listen-edit', authUser.id), {
      limit: 40,
      windowMs: 60_000,
      name: 'listen-edit',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const supabase = createSupabaseServer();

    const { data: existing, error: fetchErr } = await supabase
      .from('listens')
      .select('id, user_id, listened_at, album_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json(
        { error: 'Listen not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }
    if (existing.user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: noStoreHeaders }
      );
    }

    const { error: delErr } = await supabase
      .from('listens')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    try {
      if (existing.listened_at) {
        const d = new Date(existing.listened_at);
        await recomputeMonthlyTop(
          authUser.id,
          d.getUTCFullYear(),
          d.getUTCMonth() + 1
        );
      }
    } catch (e) {
      console.warn('monthly top recompute on delete:', e);
    }

    return NextResponse.json(
      { success: true, deletedId: id },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('DELETE listen:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete listen' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
