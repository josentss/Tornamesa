import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id: albumId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

    if (!reviewsData || reviewsData.length === 0) {
      return NextResponse.json(
        { reviews: [] },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const userIds = [...new Set(reviewsData.map((r) => r.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    const profileMap = {};
    (profiles || []).forEach((p) => {
      profileMap[p.id] = p;
    });

    const reviews = reviewsData.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        username: profileMap[r.user_id]?.username ?? 'unknown',
        avatarUrl: profileMap[r.user_id]?.avatar_url ?? null,
      },
    }));

    return NextResponse.json(
      { reviews },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('Error fetching reviews:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
