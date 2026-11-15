import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canView } from '@/lib/canView';
import {
  getMonthlyTopPayload,
  listMonthsWithActivity,
} from '@/lib/monthlyTop';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const year = parseInt(searchParams.get('year') || now.getUTCFullYear(), 10);
  const month = parseInt(
    searchParams.get('month') || now.getUTCMonth() + 1,
    10
  );
  const weekParam = searchParams.get('week');
  const week =
    weekParam != null && weekParam !== '' ? parseInt(weekParam, 10) : null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 500);
  const force = searchParams.get('refresh') === '1';

  if (month < 1 || month > 12 || Number.isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 });
  }

  const viewer = await getRequestUser(request);
  const supabase = createSupabaseServer();

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public')
      .ilike('username', username)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!canView(viewer, profile, 'top')) {
      return NextResponse.json({ error: 'This top is private' }, { status: 403 });
    }
    if (force && viewer?.id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await getMonthlyTopPayload(
      profile.id,
      year,
      month,
      Number.isNaN(week) ? null : week,
      limit,
      force
    );

    const months = await listMonthsWithActivity(profile.id);

    return NextResponse.json(
      {
        username: profile.username,
        ...payload,
        availableMonths: months,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('monthly-top error:', err);
    return NextResponse.json({ error: 'Failed to load monthly top' }, { status: 500 });
  }
}
