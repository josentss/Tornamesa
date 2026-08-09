import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
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
  const month = parseInt(searchParams.get('month') || now.getUTCMonth() + 1, 10);
  const weekParam = searchParams.get('week');
  const week = weekParam != null && weekParam !== '' ? parseInt(weekParam, 10) : null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 500);

  if (month < 1 || month > 12 || Number.isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payload = await getMonthlyTopPayload(
      profile.id,
      year,
      month,
      Number.isNaN(week) ? null : week,
      limit
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
