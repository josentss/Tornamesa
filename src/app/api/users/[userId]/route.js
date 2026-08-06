import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

async function getRequestUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

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
      .maybeSingle();

    if (error) {
      console.error('GET profile error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to load profile' },
        { status: 500 }
      );
    }

    if (!data) {
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

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET profile exception:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const { userId } = params;

  try {
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

    if (username) {
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

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
      pronouns: sanitizeString(pronouns) || null,
      country: country || null,
      website: sanitizeString(website) || null,
      bio: sanitizeString(bio) || null,
      favorite_albums: Array.isArray(favorite_albums) ? favorite_albums : [],
    };

    if (username) {
      payload.username = username.toLowerCase();
    }

    // No updated_at — avoids 500 if the column does not exist
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select(
        'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums'
      )
      .maybeSingle();

    if (error) {
      console.error('Upsert profile error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated',
      data,
    });
  } catch (error) {
    console.error('PUT profile error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
