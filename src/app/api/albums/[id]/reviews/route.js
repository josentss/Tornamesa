import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  const { id: albumId } = params;

  if (!albumId) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(
        `
        id,
        rating,
        review_text,
        created_at,
        updated_at,
        user_id,
        profiles (
          id,
          username,
          avatar_url
        )
      `
      )
      .eq('album_id', albumId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    let rows = data || [];

    const missing = rows.filter((r) => !r.profiles?.username).map((r) => r.user_id);
    if (missing.length > 0) {
      const ids = [...new Set(missing.filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      const map = {};
      (profiles || []).forEach((p) => {
        map[p.id] = p;
      });
      rows = rows.map((r) => ({
        ...r,
        profiles: r.profiles?.username ? r.profiles : map[r.user_id] || null,
      }));
    }

    const reviews = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.review_text || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: {
        id: r.profiles?.id || r.user_id,
        username: r.profiles?.username || 'unknown',
        avatarUrl: r.profiles?.avatar_url || null,
      },
    }));

    return NextResponse.json(
      { reviews },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET album reviews:', err);
    return NextResponse.json({ error: err.message || 'Failed to load reviews' }, { status: 500 });
  }
}
