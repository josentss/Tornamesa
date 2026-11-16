import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canViewWithFollows } from '@/lib/visibilityAccess';
import { normalizeTimeZone, localDateKey } from '@/lib/timezone';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import { getMonthlyTopPayload, listMonthsWithActivity } from '@/lib/monthlyTop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const viewer = await getRequestUser(request);
  const supabase = createSupabaseServer();

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, timezone')
      .ilike('username', username)
      .maybeSingle();
    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!await canViewWithFollows(supabase, viewer, profile, 'top')) {
      return NextResponse.json({ error: 'This top is private' }, { status: 403 });
    }

    const localToday = localDateKey(new Date(), normalizeTimeZone(profile.timezone || 'UTC'));
    const [defaultYear, defaultMonth] = localToday.split('-').map(Number);
    const yearArg = searchParams.get('year');
    const monthArg = searchParams.get('month');
    const weekArg = searchParams.get('week');
    const limitArg = searchParams.get('limit');
    const year = yearArg == null ? defaultYear : Number(yearArg);
    const month = monthArg == null ? defaultMonth : Number(monthArg);
    const week = weekArg == null || weekArg === '' ? null : Number(weekArg);
    const limit = limitArg == null ? 500 : Number(limitArg);

    if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
        !Number.isInteger(month) || month < 1 || month > 12 ||
        (week != null && (!Number.isInteger(week) || week < 1 || week > 6)) ||
        !Number.isInteger(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ error: 'Invalid period, week or limit' }, { status: 400 });
    }

    const force = searchParams.get('refresh') === '1';
    if (force) {
      if (viewer?.id !== profile.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const rl = await rateLimit(clientKey(request, 'monthly-top-refresh', viewer.id), {
        limit: 3,
        windowMs: 60_000,
        name: 'monthly-top-refresh',
      });
      if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
    }

    const [payload, months] = await Promise.all([
      getMonthlyTopPayload(profile.id, year, month, week, limit, force),
      listMonthsWithActivity(profile.id),
    ]);

    return NextResponse.json(
      { username: profile.username, ...payload, availableMonths: months },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('monthly-top error:', err);
    return NextResponse.json({ error: 'Failed to load monthly top' }, { status: 500 });
  }
}
