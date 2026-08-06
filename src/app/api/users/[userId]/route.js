import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

async function getRequestUser(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user) return null;
    return user;
  }
  return null;
}

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums'
      )
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

  const authUser = await getRequestUser(request);
  if (!authUser || authUser.id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    username,
    full_name,
    avatar_url,
    pronouns,
    country,
    website,
    bio,
    favorite_albums,
  } = body;

  if (username && !validateUsername(username)) {
    return NextResponse.json(
      {
        error:
          'Invalid username. Use 3–20 characters: letters, numbers, _ or -.',
      },
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
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    const payload = {
      id: userId,
      full_name: sanitizeString(full_name),
      avatar_url: avatar_url || null,
      pronouns: sanitizeString(pronouns),
      country: country || null,
      website: sanitizeString(website),
      bio: sanitizeString(bio),
      favorite_albums: favorite_albums || [],
      updated_at: new Date().toISOString(),
    };

    if (username) {
      payload.username = username.toLowerCase();
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Profile updated',
      data,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
