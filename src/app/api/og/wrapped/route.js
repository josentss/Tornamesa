import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function coverToDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const now = new Date();
  const year = parseInt(searchParams.get('year') || String(now.getUTCFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(now.getUTCMonth() + 1), 10);

  if (!username) {
    return new Response('Missing username', { status: 400 });
  }

  try {
    const supabase = supabaseAdmin();

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (profileErr || !profile) {
      return new Response('User not found', { status: 404 });
    }

    const { data: summary } = await supabase
      .from('monthly_summaries')
      .select('id, total_listens, unique_albums')
      .eq('user_id', profile.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    let albums = [];
    let totalListens = 0;
    let uniqueAlbums = 0;

    if (summary) {
      totalListens = summary.total_listens || 0;
      uniqueAlbums = summary.unique_albums || 0;

      const { data: entries } = await supabase
        .from('monthly_top_entries')
        .select('rank, album_id, listen_count')
        .eq('summary_id', summary.id)
        .is('week', null)
        .order('rank', { ascending: true })
        .limit(5);

      const ids = (entries || []).map((e) => e.album_id);
      const albumMap = {};

      if (ids.length > 0) {
        const { data: rows } = await supabase
          .from('albums')
          .select('spotify_id, title, artist, cover_url')
          .in('spotify_id', ids);
        (rows || []).forEach((a) => {
          albumMap[a.spotify_id] = a;
        });
      }

      albums = await Promise.all(
        (entries || []).map(async (e) => {
          const a = albumMap[e.album_id];
          const cover = await coverToDataUrl(a?.cover_url || null);
          return {
            rank: e.rank,
            title: a?.title || 'Unknown album',
            artist: a?.artist || '',
            cover,
            count: e.listen_count,
          };
        })
      );
    }

    const label = `${MONTH_NAMES[month - 1] || ''} ${year}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0f16',
            padding: 48,
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 36,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 20,
                  color: '#7cc7e8',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Monthly Wrapped
              </div>
              <div
                style={{
                  fontSize: 40,
                  color: '#f0f9ff',
                  fontWeight: 700,
                  marginTop: 8,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 22, color: '#94a3b8', marginTop: 6 }}>
                @{profile.username}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ fontSize: 34, color: '#f0f9ff', fontWeight: 700 }}>
                {totalListens}
              </div>
              <div style={{ fontSize: 15, color: '#64748b' }}>listens</div>
              <div
                style={{
                  fontSize: 26,
                  color: '#f0f9ff',
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                {uniqueAlbums}
              </div>
              <div style={{ fontSize: 15, color: '#64748b' }}>albums</div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              flex: 1,
            }}
          >
            {albums.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  background: i === 0 ? '#131e2c' : 'transparent',
                  borderRadius: 12,
                  padding: i === 0 ? '10px 14px' : '4px 6px',
                  border: i === 0 ? '1px solid rgba(124,199,232,0.35)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    fontSize: i === 0 ? 26 : 20,
                    fontWeight: 700,
                    color: i === 0 ? '#7cc7e8' : '#64748b',
                  }}
                >
                  {item.rank}
                </div>
                {item.cover ? (
                  <img
                    src={item.cover}
                    width={i === 0 ? 68 : 52}
                    height={i === 0 ? 68 : 52}
                    style={{ borderRadius: 8, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: i === 0 ? 68 : 52,
                      height: i === 0 ? 68 : 52,
                      borderRadius: 8,
                      background: '#1f2b3a',
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: i === 0 ? 24 : 18,
                      color: '#f0f9ff',
                      fontWeight: 600,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 15, color: '#64748b' }}>
                    {item.artist}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#7cc7e8',
                  }}
                >
                  ×{item.count}
                </div>
              </div>
            ))}
            {albums.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 20 }}>
                No listens this month
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 24,
              borderTop: '1px solid #2a3645',
              paddingTop: 18,
            }}
          >
            <div style={{ fontSize: 18, color: '#7cc7e8', fontWeight: 700 }}>
              Tornamesa
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>tornamesa.app</div>
          </div>
        </div>
      ),
      { width: 1080, height: 1350 }
    );
  } catch (err) {
    console.error('Wrapped OG error:', err);
    return new Response(String(err?.message || err), { status: 500 });
  }
}
