import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sanitizeString } from '@/lib/validators';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import {
  normalizeTimeZone,
  monthsFromIsoInZone,
  zonedLocalToUtc,
} from '@/lib/timezone';

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

    const fields = {};
    const oldIso = existing.listened_at || null;

    if (body.listened_at != null && body.listened_at !== '') {
      let iso = String(body.listened_at).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
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
      fields.listened_at = iso;
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
        body.review === null || body.review === ''
          ? null
          : sanitizeString(body.review);
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
      .select()
      .single();

    if (updateErr) throw updateErr;

    try {
      const months = new Set();
      if (oldIso) {
        for (const { year, month } of monthsFromIsoInZone(oldIso, tz)) {
          months.add(`${year}-${month}`);
        }
      }
      const newIso = fields.listened_at || oldIso;
      if (newIso) {
        for (const { year, month } of monthsFromIsoInZone(newIso, tz)) {
          months.add(`${year}-${month}`);
        }
      }
      for (const key of months) {
        const [y, m] = key.split('-').map(Number);
        await recomputeMonthlyTop(authUser.id, y, m, tz);
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

    try {
      if (existing.listened_at) {
        for (const { year, month } of monthsFromIsoInZone(
          existing.listened_at,
          tz
        )) {
          await recomputeMonthlyTop(authUser.id, year, month, tz);
        }
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
