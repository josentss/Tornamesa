import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const { id: albumId } = params;
  const supabase = createSupabaseServer();

  try {
    // 1. Obtener las reseñas
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (reviewsError) throw reviewsError;

    if (!reviewsData || reviewsData.length === 0) {
      return NextResponse.json({ reviews: [] });
    }

    // 2. Obtener los perfiles de los autores
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

    // 3. Armar la respuesta combinada
    const reviews = reviewsData.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        username: profileMap[r.user_id]?.username ?? 'desconocido',
        avatarUrl: profileMap[r.user_id]?.avatar_url ?? null,
      },
    }));

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('Error al obtener reseñas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
