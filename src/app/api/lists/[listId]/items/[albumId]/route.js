import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export async function DELETE(request, { params }) {
  const { listId, albumId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();

    const supabase = createSupabaseServer();

    const { data: list } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .single();

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    if (list.user_id !== authUser.id) return forbidden();

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
