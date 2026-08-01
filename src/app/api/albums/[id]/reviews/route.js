import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { id: albumId } = params;
  const supabase = createSupabaseServer();

  try {
    // 1. Obtener reseñas
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
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    // 2. Obtener los IDs únicos de usuarios
    const userIds = [...new Set(reviewsData.map((r) => r.user_id))];

    // 3. Obtener perfiles uno por uno para evitar problemas con la consulta in
    const profiles = [];
    for (const userId of userIds) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', userId)
        .single();

      if (!profileError && profile) {
        profiles.push(profile);
      }
    }

    // 4. Crear mapa de perfiles
    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.id] = {
        username: p.username || 'unknown',
        avatarUrl: p.avatar_url || null,
      };
    });

    // 5. Armar la respuesta final
    const reviews = reviewsData.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        username: profileMap[r.user_id]?.username || 'unknown',
        avatarUrl: profileMap[r.user_id]?.avatarUrl || null,
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
