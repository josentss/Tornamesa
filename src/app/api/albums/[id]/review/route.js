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
    // 1. Autenticar usuario
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

    // 2. Buscar si ya existe una reseña del usuario para este álbum
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('album_id', albumId)
      .single();

    let review;

    if (existingReview) {
      // Actualizar reseña existente
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('reviews')
        .update({
          rating: numericRating,
          review_text: review_text || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReview.id)
        .select()
        .single();

      if (updateError) throw updateError;
      review = updated;
    } else {
      // Insertar nueva reseña
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('reviews')
        .insert({
          user_id: user.id,
          album_id: albumId,
          rating: numericRating,
          review_text: review_text || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      review = inserted;
    }

    // 3. Registrar escucha (opcional)
    await supabaseAdmin.from('listens').insert({
      user_id: user.id,
      album_id: albumId,
      listened_at: new Date().toISOString(),
    });

    // 4. Obtener perfil del autor
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
        user: {
          id: user.id,
          username: profile?.username ?? 'unknown',
          avatarUrl: profile?.avatar_url ?? null,
        },
      },
    });
  } catch (err) {
    console.error('Error al guardar reseña:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
