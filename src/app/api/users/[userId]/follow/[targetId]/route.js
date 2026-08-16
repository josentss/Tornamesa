import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export async function DELETE(request, { params }) {
  const { userId, targetId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();
    if (authUser.id !== userId) return forbidden();

    const supabase = createSupabaseServer();
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', authUser.id)
      .eq('following_id', targetId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
