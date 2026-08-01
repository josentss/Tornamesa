import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// client con anon key
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request, { params }) {
  const { id: albumId } = params;

  try {
    // leer token del header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // verificar token y obtener usuario
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    // leer rating y review_text del body
    const { rating, review_text } = await request.json();
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating inválido (1-5)' }, { status: 400 });
    }

    // insertar o actualizar si ya existe
    const supabaseServer = createSupabaseServer();
    const supabaseAdmin = createSupabaseServer();

    // upsert utilizando la constraint única
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .upsert({
        user_id: user.id,
        album_id: albumId,
        rating,
        review_text: review_text || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, album_id' })
      .select()
      .single();

    if (error) throw error;

    // registrar automáticamente una escucha en el historial
    await supabaseAdmin.from('listens').insert({
      user_id: user.id,
      album_id: albumId,
      listened_at: new Date().toISOString(),
    }).then(({ error: listenError }) => {
      if (listenError) console.error('Error al registrar escucha:', listenError);
    });

    return NextResponse.json({
      success: true,
      review: {
        id: data.id,
        rating: data.rating,
        reviewText: data.review_text,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (err) {
    console.error('Error al crear/actualizar reseña:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
