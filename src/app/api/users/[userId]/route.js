import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        id: userId,
        username: '',
        full_name: '',
        avatar_url: '',
        pronouns: '',
        country: '',
        website: '',
        bio: '',
        favorite_albums: [],
      });
    }
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { userId } = params;
  const body = await request.json();
  const { username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums } = body;

  if (username && !validateUsername(username)) {
    return NextResponse.json(
      { error: 'Username inválido. Solo letras, números, _ y -. Entre 3-20 caracteres.' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  try {
    if (username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .not('id', 'eq', userId)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'El nombre de usuario ya está en uso' }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username: username ? username.toLowerCase() : undefined,
        full_name: sanitizeString(full_name),
        avatar_url,
        pronouns: sanitizeString(pronouns),
        country,
        website: sanitizeString(website),
        bio: sanitizeString(bio),
        favorite_albums: favorite_albums || [],
      }, { onConflict: 'id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado',
      data: data[0],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
