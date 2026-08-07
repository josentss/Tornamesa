import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROFILE_COLS =
  'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, onboarding_completed, is_private, diary_public, show_activity';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

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
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function normalizeProfile(data, userId) {
  if (!data) {
    return {
      id: userId,
      username: '',
      full_name: '',
      avatar_url: '',
      pronouns: '',
      country: '',
      website: '',
      bio: '',
      favorite_albums: [],
      onboarding_completed: false,
      is_private: false,
      diary_public: true,
      show_activity: true,
    };
  }
  return {
    id: data.id,
    username: data.username || '',
    full_name: data.full_name || '',
    avatar_url: data.avatar_url || '',
    pronouns: data.pronouns || '',
    country: data.country || '',
    website: data.website || '',
    bio: data.bio || '',
    favorite_albums: Array.isArray(data.favorite_albums)
      ? data.favorite_albums
      : [],
    onboarding_completed: !!data.onboarding_completed,
    is_private: !!data.is_private,
    diary_public: data.diary_public !== false,
    show_activity: data.show_activity !== false,
  };
}

export async function GET(request, { params }) {
  const { userId } = params;
  const supabase = createSupabaseServer();

  try {
    const data = await fetchProfileByUserId(supabase, userId);
    return NextResponse.json(normalizeProfile(data, userId), {
      headers: noStoreHeaders,
    });
  } catch (error) {
    console.error('GET /api/users/[userId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load profile' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function PUT(request, { params }) {
  const { userId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser || authUser.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
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
      onboarding_completed,
      is_private,
      diary_public,
      show_activity,
    } = body;

    const cleanUsername = username
      ? String(username).trim().toLowerCase()
      : null;

    if (cleanUsername && !validateUsername(cleanUsername)) {
      return NextResponse.json(
        {
          error:
            'Invalid username. Use 3–20 characters: letters, numbers, _ or -.',
        },
        { status: 400, headers: noStoreHeaders }
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
          { status: 409, headers: noStoreHeaders }
        );
      }
    }

    // Only set fields that were actually sent (partial updates safe)
    const fields = {};
    if (full_name !== undefined)
      fields.full_name = sanitizeString(full_name) || null;
    if (avatar_url !== undefined) fields.avatar_url = avatar_url || null;
    if (pronouns !== undefined)
      fields.pronouns = sanitizeString(pronouns) || null;
    if (country !== undefined) fields.country = country || null;
    if (website !== undefined)
      fields.website = sanitizeString(website) || null;
    if (bio !== undefined) fields.bio = sanitizeString(bio) || null;
    if (favorite_albums !== undefined) {
      fields.favorite_albums = Array.isArray(favorite_albums)
        ? favorite_albums
        : [];
    }
    if (typeof onboarding_completed === 'boolean') {
      fields.onboarding_completed = onboarding_completed;
    }
    if (typeof is_private === 'boolean') fields.is_private = is_private;
    if (typeof diary_public === 'boolean') fields.diary_public = diary_public;
    if (typeof show_activity === 'boolean')
      fields.show_activity = show_activity;
    if (cleanUsername) fields.username = cleanUsername;

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
      if (!cleanUsername) {
        return NextResponse.json(
          { error: 'Username is required to create a profile' },
          { status: 400, headers: noStoreHeaders }
        );
      }
      const result = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: cleanUsername,
          onboarding_completed: false,
          is_private: false,
          diary_public: true,
          show_activity: true,
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
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated',
        data: normalizeProfile(data, userId),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('PUT /api/users/[userId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function DELETE(request, { params }) {
  const { userId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser || authUser.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = createSupabaseServer();

    // Best-effort cleanup of related rows (ignore errors if tables/FKs differ)
    const related = [
      'listens',
      'reviews',
      'list_items',
      'lists',
      'follows',
      'monthly_tops',
    ];
    for (const table of related) {
      try {
        if (table === 'follows') {
          await supabase
            .from('follows')
            .delete()
            .or(`follower_id.eq.${userId},following_id.eq.${userId}`);
        } else if (table === 'list_items') {
          // list_items usually via list_id — skip if no user_id column
          await supabase.from('list_items').delete().eq('user_id', userId);
        } else {
          await supabase.from(table).delete().eq('user_id', userId);
        }
      } catch (e) {
        console.warn(`Cleanup ${table}:`, e?.message || e);
      }
    }

    await supabase.from('profiles').delete().eq('id', userId);

    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('admin.deleteUser:', authErr);
      return NextResponse.json(
        { error: authErr.message || 'Could not delete auth user' },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Account deleted' },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('DELETE /api/users/[userId]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
