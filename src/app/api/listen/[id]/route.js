import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeString } from '@/lib/validators';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import { normalizeTimeZone, zonedLocalToUtc } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

async function userTimeZone(supabase, userId) {
  const { data: prof } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();
  return normalizeTimeZone(prof?.timezone || 'UTC');
}

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
    const tz = await userTimeZone(supabase, authUser.id);

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

    let listenedAt = null;
    let changeDate = false;
    if (body.listened_at != null && body.listened_at !== '') {
      let iso = String(body.listened_at).trim();
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== iso) {
          return NextResponse.json(
            { error: 'Invalid listened_at' },
            { status: 400, headers: noStoreHeaders }
          );
        }
        iso = zonedLocalToUtc(y, m, d, 12, 0, 0, tz).toISOString();
      } else {
        const parsed = new Date(iso);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: 'Invalid listened_at' },
            { status: 400, headers: noStoreHeaders }
          );
        }
        iso = parsed.toISOString();
      }
      listenedAt = iso;
      changeDate = true;
    }

    const changeReview = body.rating !== undefined || body.review !== undefined;
    let rating = null;
    let reviewText = null;
    if (changeReview) {
      // These fields are ONE global album review, not values for this listen.
      // An explicit rating is required to avoid silently deleting a review
      // when an older client sends only per-listen notes.
      if (!Object.prototype.hasOwnProperty.call(body, 'rating')) {
        return NextResponse.json(
          { error: 'Album rating is required to update an album review' },
          { status: 400, headers: noStoreHeaders }
        );
      }
      if (body.rating !== null && body.rating !== '') {
        rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
          return NextResponse.json(
            { error: 'Rating must be an integer between 1 and 10' },
            { status: 400, headers: noStoreHeaders }
          );
        }
      }
      reviewText = body.review == null ? null : sanitizeString(body.review);
      if (rating === null && reviewText) {
        return NextResponse.json(
          { error: 'An album review requires a rating' },
          { status: 400, headers: noStoreHeaders }
        );
      }
    }

    if (!changeDate && !changeReview) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // Keep date edits and the canonical review write in ONE DB transaction.
    // The existing review trigger marks every affected month dirty.
    const { data: updated, error: updateErr } = await supabase
      .rpc('update_listen_and_album_review', {
        p_user_id: authUser.id,
        p_listen_id: Number(id),
        p_change_date: changeDate,
        p_listened_at: listenedAt,
        p_change_review: changeReview,
        p_rating: rating,
        p_review_text: reviewText,
      });
    if (updateErr) throw updateErr;
    if (!updated?.id) throw new Error('Album review update returned no listen');

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
    const tz = await userTimeZone(supabase, authUser.id);

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

    // SQL trigger invalidates the month before DELETE returns.
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
