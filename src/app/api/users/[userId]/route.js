import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

const PROFILE_COLS =
  'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums';

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

async function fetchProfileByUserId(supabase, userId) {
  // Primary: profiles.id = auth.users.id
  let { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // Fallback if the project ever used user_id
  const second = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('user_id', userId)
    .maybeSingle();

  if (second.error) {
    // column may not exist — ignore
    return null;
  }
  return second.data;
}

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const data = await fetchProfileByUserId(supabase, userId);

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
    console.error('GET /api/users/[userId]:', error);
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

    const cleanUsername = username ? String(username).trim().toLowerCase() : null;

    if (cleanUsername && !validateUsername(cleanUsername)) {
      return NextResponse.json(
        {
          error:
            'Invalid username. Use 3–20 characters: letters, numbers, _ or -.',
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

    if (cleanUsername) {
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .neq('id', userId)
        .maybeSingle();

      if (taken) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }
    }

    const fields = {
      full_name: sanitizeString(full_name) || null,
      avatar_url: avatar_url || null,
      pronouns: sanitizeString(pronouns) || null,
      country: country || null,
      website: sanitizeString(website) || null,
      bio: sanitizeString(bio) || null,
      favorite_albums: Array.isArray(favorite_albums) ? favorite_albums : [],
    };

    if (cleanUsername) {
      fields.username = cleanUsername;
    }

    // Does a row exist?
    const existing = await fetchProfileByUserId(supabase, userId);

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from('profiles')
        .update(fields)
        .eq('id', existing.id)
        .select(PROFILE_COLS)
        .maybeSingle();
      data = result.data;
      error = result.error;
    } else {
      // Create row: id must be auth user id
      if (!cleanUsername) {
        return NextResponse.json(
          { error: 'Username is required to create a profile' },
          { status: 400 }
        );
      }
      const result = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: cleanUsername,
          ...fields,
        })
        .select(PROFILE_COLS)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Save profile error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to save profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated',
      data,
    });
  } catch (error) {
    console.error('PUT /api/users/[userId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
