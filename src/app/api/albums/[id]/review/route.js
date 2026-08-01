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

    const { data, error } = await supabaseAdmin
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

    await supabaseAdmin.from('listens').insert({
      user_id: user.id,
      album_id: albumId,
      listened_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      review: {
        id: data.id,
        rating: data.rating,
        reviewText: data.review_text,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err) {
    console.error('Error al guardar reseña:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
