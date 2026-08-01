import { NextResponse } from 'next/server';

// force ruta dinámica y nunca se cachee
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { id: albumId } = params;

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Obtener reseñas (sin caché)
    const reviewsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?album_id=eq.${albumId}&order=created_at.desc`,
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      }
    );

    if (!reviewsRes.ok) {
      const err = await reviewsRes.json().catch(() => ({}));
      throw new Error(err.message || 'Error fetching reviews');
    }

    const reviewsData = await reviewsRes.json();

    if (!reviewsData || reviewsData.length === 0) {
      return NextResponse.json(
        { reviews: [] },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    // 2. Obtener los perfiles de los autores
    const userIds = [...new Set(reviewsData.map((r) => r.user_id))];
    const idsQuery = userIds.map((id) => `id=eq.${id}`).join('&');
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?${idsQuery}&select=id,username,avatar_url`,
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        cache: 'no-store',
      }
    );

    let profiles = [];
    if (profilesRes.ok) {
      profiles = await profilesRes.json();
    }

    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.id] = p;
    });

    // 3. Armar la respuesta
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
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (err) {
    console.error('GET reviews error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
