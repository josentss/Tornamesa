import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request, { params }) {
  const { id } = params;
  const supabase = createSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        review_text,
        created_at,
        updated_at,
        user_id,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq('album_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviews = data.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.user_id,
        username: r.profiles?.username ?? 'desconocido',
        avatarUrl: r.profiles?.avatar_url ?? null,
      },
    }));

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('Error al obtener reseñas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
