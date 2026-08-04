import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { ensureToListenList, getListsWithCounts } from '@/lib/lists';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { userId } = params;

  try {
    const lists = await getListsWithCounts(userId);
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

    // Asegurar To Listen y que el user exista
    await ensureToListenList(userId);

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        user_id: userId,
        name,
        description,
        is_system: false,
      })
      .select('id, user_id, name, description, is_system, created_at, updated_at')
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
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
