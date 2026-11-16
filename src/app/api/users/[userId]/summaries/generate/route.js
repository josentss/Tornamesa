import { NextResponse } from 'next/server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';
import { recomputeMonthlyTop } from '@/lib/monthlyTop';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { userId } = params;

  try {
    const viewer = await getRequestUser(request);
    if (!viewer) return unauthorized();
    if (viewer.id !== userId) return forbidden();

    const rl = await rateLimit(clientKey(request, 'summary-gen', viewer.id), {
      limit: 5,
      windowMs: 60_000,
      name: 'summary-gen',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month);
    if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
        !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Valid year and month (1-12) are required' },
        { status: 400 }
      );
    }

    // Same transaction/algorithm as public monthly-top reads.
    // Do not write removed fields total_minutes or top_artist.
    const summary = await recomputeMonthlyTop(viewer.id, year, month);
    if ((summary.total_listens || 0) === 0) {
      return NextResponse.json({ error: 'No listens for this month' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Summary generated for ${month}/${year}`,
      summary,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('generate summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
