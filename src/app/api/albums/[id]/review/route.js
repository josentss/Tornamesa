import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request, { params }) {
  const { id: albumId } = params;

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { rating, review_text } = await request.json();
    const numericRating = Number(rating);
    if (!rating || numericRating < 1 || numericRating > 10) {
      return NextResponse.json({ error: 'Rating inválido (1-10)' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseServer();

    // Upsert de la reseña
    const { data: reviewData, error } = await supabaseAdmin
      .from('reviews')
      .upsert(
        {
          user_id: user.id,
          album_id: albumId,
          rating: numericRating,
          review_text: review_text || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, album_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Insertar escucha
    await supabaseAdmin.from('listens').insert({
      user_id: user.id,
      album_id: albumId,
      listened_at: new Date().toISOString(),
    });

    // Obtener datos del perfil para devolverlos al frontend
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      review: {
        id: reviewData.id,
        rating: reviewData.rating,
        reviewText: reviewData.review_text,
        createdAt: reviewData.created_at,
        updatedAt: reviewData.updated_at,
        user: {
          id: user.id,
          username: profile?.username ?? 'desconocido',
          avatarUrl: profile?.avatar_url ?? null,
        },
      },
    });
  } catch (err) {
    console.error('Error al guardar reseña:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
