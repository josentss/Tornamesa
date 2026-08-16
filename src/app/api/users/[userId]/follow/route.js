import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser, unauthorized, forbidden } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  const { userId } = params;

  try {
    const authUser = await getRequestUser(request);
    if (!authUser) return unauthorized();
    if (authUser.id !== userId) return forbidden();

    const { targetId } = await request.json();
    if (!targetId) {
      return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
    }
    if (targetId === authUser.id) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    const { error } = await supabase.from('follows').insert([
      { follower_id: authUser.id, following_id: targetId },
    ]);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, already: true });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
