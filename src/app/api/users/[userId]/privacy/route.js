import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function PATCH(request, { params }) {
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
    const fields = {};

    if (typeof body.is_private === 'boolean') {
      fields.is_private = body.is_private;
    }
    if (typeof body.diary_public === 'boolean') {
      fields.diary_public = body.diary_public;
    }
    if (typeof body.show_activity === 'boolean') {
      fields.show_activity = body.show_activity;
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: 'No privacy fields provided' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const supabase = createSupabaseServer();

    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', userId)
      .select('id, is_private, diary_public, show_activity')
      .maybeSingle();

    if (error) {
      console.error('PATCH privacy error:', error);
      return NextResponse.json(
        {
          error:
            error.message ||
            'Failed to update privacy. Check that columns exist in profiles.',
        },
        { status: 500, headers: noStoreHeaders }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          is_private: data.is_private === true,
          diary_public: data.diary_public !== false,
          show_activity: data.show_activity !== false,
        },
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('PATCH /privacy:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update privacy' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
