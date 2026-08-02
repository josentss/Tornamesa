import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { username } = params;
  const supabase = createSupabaseServer();

  try {
    // Obtener perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, pronouns, country, website, bio, favorite_albums, created_at')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = profile.id;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Conteos anual y mensual
    const [{ count: yearlyListens }, { count: monthlyListens }] = await Promise.all([
      supabase.from('listens').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('listened_at', startOfYear),
      supabase.from('listens').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('listened_at', startOfMonth),
    ]);

    // Monthly top 5 álbumes
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('listens')
      .select('album_id, albums!inner(spotify_id, title, artist, cover_url)')
      .eq('user_id', userId)
      .gte('listened_at', startOfMonth)
      .lte('listened_at', endOfMonth);

    if (monthlyError) throw monthlyError;

    const albumCounts = {};
    monthlyData.forEach((item) => {
      const album = item.albums;
      if (album) {
        const key = album.spotify_id;
        if (!albumCounts[key]) {
          albumCounts[key] = { count: 0, title: album.title, artist: album.artist, cover: album.cover_url };
        }
        albumCounts[key].count++;
      }
    });

    const monthlyTop = Object.values(albumCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Distribución de ratings (1-10) desde reviews
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating')
      .eq('user_id', userId);

    if (reviewsError) throw reviewsError;

    const ratingDistribution = {};
    for (let i = 1; i <= 10; i++) ratingDistribution[i] = 0;
    reviewsData.forEach((r) => {
      if (ratingDistribution[r.rating] !== undefined) ratingDistribution[r.rating]++;
    });

    // Actividad reciente agrupada (últimos 10 discos únicos con multiplicador diario)
    const { data: recentListens, error: recentError } = await supabase
      .from('listens')
      .select('album_id, listened_at, albums!inner(spotify_id, title, artist, cover_url)')
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(50); // Tomamos más para agrupar

    if (recentError) throw recentError;

    // Agrupar por día y álbum
    const grouped = {};
    recentListens.forEach((item) => {
      const day = item.listened_at.split('T')[0]; // YYYY-MM-DD
      const album = item.albums;
      if (!album) return;
      const key = `${day}_${album.spotify_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: day,
          album: {
            id: album.spotify_id,
            title: album.title,
            artist: album.artist,
            cover: album.cover_url,
          },
          count: 0,
        };
      }
      grouped[key].count++;
    });

    // Ordenar por fecha descendente y tomar los 10 más recientes
    const recentActivity = Object.values(grouped)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // Listas (placeholder)
    const lists = []; // TODO: implementar tablas de listas

    return NextResponse.json({
      yearlyListens,
      monthlyListens,
      monthlyTop,
      ratingDistribution,
      recentActivity,
      lists,
    });
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
