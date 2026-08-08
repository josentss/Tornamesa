import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeString } from '@/lib/validators';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

async function getRequestUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
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

    // listened_at: accept YYYY-MM-DD or full ISO
    if (body.listened_at != null && body.listened_at !== '') {
      let iso = String(body.listened_at).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        // Keep midday UTC to avoid timezone day-shift
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

    if (body.rating !== undefined) {
      if (body.rating === null || body.rating === '') {
        fields.rating = null;
      } else {
        const num = Number(body.rating);
        if (Number.isNaN(num) || num < 1 || num > 10) {
          return NextResponse.json(
            { error: 'Rating must be between 1 and 10' },
            { status: 400, headers: noStoreHeaders }
          );
        }
        fields.rating = num;
      }
    }

    if (body.review !== undefined) {
      fields.review =
        body.review && String(body.review).trim()
          ? sanitizeString(String(body.review).trim())
          : null;
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

    // Monthly top: recompute old + new month if date moved
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
