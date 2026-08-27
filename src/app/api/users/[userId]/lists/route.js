import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ensureToListenList, getListsWithCounts } from '@/lib/lists';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { userId } = params;
  const { searchParams } = new URL(request.url);
  const albumId = searchParams.get('albumId');

  try {
    const supabase = createSupabaseServer();

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', userId)
      .maybeSingle();

    const authUser = await getRequestUser(request);
    const isOwner = authUser?.id === userId;
    const isPrivate = profile?.is_private === true;

    if (albumId) {
      if (!authUser) return unauthorized();
      if (!isOwner) return forbidden();
    } else if (isPrivate && !isOwner) {
      return NextResponse.json(
        { error: 'This profile is private', lists: [] },
        { status: 403 }
      );
    }

    const lists = await getListsWithCounts(userId);

    if (albumId) {
      const listIds = lists.map((l) => l.id);

      if (listIds.length === 0) {
        return NextResponse.json(
          { lists: [] },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const { data: memberships } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('album_id', albumId)
        .in('list_id', listIds);

      const inList = new Set((memberships || []).map((m) => m.list_id));

      return NextResponse.json(
        {
          lists: lists.map((l) => ({
            ...l,
            containsAlbum: inList.has(l.id),
          })),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
      );
    }

    return NextResponse.json(
      { lists },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (err) {
    console.error('GET lists error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { userId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();
    if (authUser.id !== userId) return forbidden();

    const body = await request.json();
    const name = (body.name || '').trim();
    const description = (body.description || '').trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (name.toLowerCase() === 'to listen') {
      return NextResponse.json(
        { error: 'This name is reserved for the system list' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    await ensureToListenList(authUser.id);

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        user_id: authUser.id,
        name,
        description,
        is_system: false,
      })
      .select(
        'id, user_id, name, description, is_system, created_at, updated_at'
      )
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        list: {
          id: list.id,
          name: list.name,
          description: list.description,
          isSystem: list.is_system,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
          count: 0,
          previewCovers: [],
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
