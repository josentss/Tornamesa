import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function DELETE(request, { params }) {
  const { listId, albumId } = params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    const { data: list } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .single();

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (list.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('album_id', albumId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE list item error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
