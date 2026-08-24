import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUsername, sanitizeString } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROFILE_COLS =
  'id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, onboarding_completed, is_private, diary_public, show_activity, instagram, twitter, rym, username_changed_at';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

const USERNAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function sanitizeHandle(value, kind) {
  if (value == null || value === '') return null;
  let s = String(value).trim();
  s = s.replace(/^@/, '');
  if (kind === 'instagram') {
    s = s
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .split(/[/?#]/)[0];
  } else if (kind === 'twitter') {
    s = s
      .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '')
      .split(/[/?#]/)[0];
  } else if (kind === 'rym') {
    s = s
      .replace(/^https?:\/\/(www\.)?rateyourmusic\.com\/~/i, '')
      .replace(/^https?:\/\/(www\.)?rateyourmusic\.com\//i, '')
      .split(/[/?#]/)[0]
      .replace(/^~/, '');
  }
  s = s.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
  return s || null;
}

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
      instagram: '',
      twitter: '',
      rym: '',
      username_changed_at: null,
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
    is_private: data.is_private === true,
    diary_public: data.diary_public !== false,
    show_activity: data.show_activity !== false,
    instagram: data.instagram || '',
    twitter: data.twitter || '',
    rym: data.rym || '',
    username_changed_at: data.username_changed_at || null,
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
      instagram,
      twitter,
      rym,
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
    const existing = await fetchProfileByUserId(supabase, userId);

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
    if (instagram !== undefined)
      fields.instagram = sanitizeHandle(instagram, 'instagram');
    if (twitter !== undefined)
      fields.twitter = sanitizeHandle(twitter, 'twitter');
    if (rym !== undefined) fields.rym = sanitizeHandle(rym, 'rym');
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

    if (cleanUsername) {
      const current = (existing?.username || '').toLowerCase();

      if (cleanUsername !== current) {
        const last = existing?.username_changed_at
          ? new Date(existing.username_changed_at)
          : null;

        if (last && Date.now() - last.getTime() < USERNAME_COOLDOWN_MS) {
          const next = new Date(last.getTime() + USERNAME_COOLDOWN_MS);
          return NextResponse.json(
            {
              error: `You can change your username again on ${next.toLocaleDateString(
                'en-US',
                { year: 'numeric', month: 'short', day: 'numeric' }
              )}.`,
              nextChangeAt: next.toISOString(),
            },
            { status: 429, headers: noStoreHeaders }
          );
        }

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

        fields.username = cleanUsername;
        fields.username_changed_at = new Date().toISOString();
      }
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'Nothing to update',
          data: normalizeProfile(existing, userId),
        },
        { headers: noStoreHeaders }
      );
    }

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
          username_changed_at: new Date().toISOString(),
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

    const { data: summaries } = await supabase
      .from('monthly_summaries')
      .select('id')
      .eq('user_id', userId);

    const summaryIds = (summaries || []).map((s) => s.id);
    if (summaryIds.length > 0) {
      await supabase
        .from('monthly_top_entries')
        .delete()
        .in('summary_id', summaryIds);
    }
    await supabase.from('monthly_summaries').delete().eq('user_id', userId);

    const { data: userLists } = await supabase
      .from('lists')
      .select('id')
      .eq('user_id', userId);

    const listIds = (userLists || []).map((l) => l.id);
    if (listIds.length > 0) {
      await supabase.from('list_items').delete().in('list_id', listIds);
    }
    await supabase.from('lists').delete().eq('user_id', userId);

    await supabase.from('listens').delete().eq('user_id', userId);
    await supabase.from('reviews').delete().eq('user_id', userId);

    await supabase
      .from('follows')
      .delete()
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`);

    try {
      await supabase.from('user_connections').delete().eq('user_id', userId);
    } catch {
    }

    await supabase.from('profiles').delete().eq('id', userId);

    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error('admin.deleteUser:', authErr);
      return NextResponse.json(
        {
          error:
            authErr.message ||
            'Profile data removed but auth user could not be deleted. Contact support.',
        },
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
