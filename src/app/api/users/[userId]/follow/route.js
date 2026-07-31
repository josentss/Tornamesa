import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(request, { params }) {
  const { userId } = params;
  const { targetId } = await request.json();

  const supabase = createSupabaseServer();

  try {
    const { error } = await supabase
      .from('follows')
      .insert([{ follower_id: userId, following_id: targetId }]);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
