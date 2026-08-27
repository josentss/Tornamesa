import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

export async function PATCH(request, { params }) {
  const { userId } = params;

  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const authUser = await getRequestUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: noStoreHeaders }
      );
    }
    if (authUser.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: noStoreHeaders }
      );
    }

    const body = await request.json();
    const fields = {};

    if (typeof body.is_private === 'boolean') fields.is_private = body.is_private;
    if (typeof body.diary_public === 'boolean')
      fields.diary_public = body.diary_public;
    if (typeof body.show_activity === 'boolean')
      fields.show_activity = body.show_activity;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: 'No privacy fields provided' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const supabase = createSupabaseServer();

    const { data: before, error: beforeErr } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, show_activity')
      .eq('id', userId)
      .maybeSingle();

    if (beforeErr) {
      return NextResponse.json(
        { error: beforeErr.message },
        { status: 500, headers: noStoreHeaders }
      );
    }
    if (!before) {
      return NextResponse.json(
        { error: 'Profile not found for this user id', userId },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', userId);

    if (updateErr) {
      console.error('PATCH privacy update error:', updateErr);
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const { data: after, error: afterErr } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, show_activity')
      .eq('id', userId)
      .maybeSingle();

    if (afterErr || !after) {
      return NextResponse.json(
        { error: afterErr?.message || 'Update could not be verified' },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId: after.id,
        username: after.username,
        before: {
          is_private: before.is_private === true,
          diary_public: before.diary_public !== false,
          show_activity: before.show_activity !== false,
        },
        data: {
          is_private: after.is_private === true,
          diary_public: after.diary_public !== false,
          show_activity: after.show_activity !== false,
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
