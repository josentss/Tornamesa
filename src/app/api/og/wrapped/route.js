import { ImageResponse } from 'next/og';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getMonthlyTopPayload } from '@/lib/monthlyTop';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const now = new Date();
  const year = parseInt(searchParams.get('year') || now.getUTCFullYear(), 10);
  const month = parseInt(searchParams.get('month') || now.getUTCMonth() + 1, 10);

  if (!username) {
    return new Response('Missing username', { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username.toLowerCase())
      .single();

    if (!profile) {
      return new Response('User not found', { status: 404 });
    }

    const payload = await getMonthlyTopPayload(profile.id, year, month, null, 5);
    const albums = payload.albums || [];
    const label = `${MONTH_NAMES[month - 1]} ${year}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0f16',
            padding: '48px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '36px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 22,
                  color: '#7cc7e8',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Monthly Wrapped
              </div>
              <div
                style={{
                  fontSize: 42,
                  color: '#f0f9ff',
                  fontWeight: 700,
                  marginTop: 8,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 24, color: '#94a3b8', marginTop: 6 }}>
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
              <div style={{ fontSize: 36, color: '#f0f9ff', fontWeight: 700 }}>
                {payload.totalListens}
              </div>
              <div style={{ fontSize: 16, color: '#64748b' }}>listens</div>
              <div
                style={{
                  fontSize: 28,
                  color: '#f0f9ff',
                  fontWeight: 700,
                  marginTop: 12,
                }}
              >
                {payload.uniqueAlbums}
              </div>
              <div style={{ fontSize: 16, color: '#64748b' }}>albums</div>
            </div>
          </div>

          {/* Top albums */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              flex: 1,
            }}
          >
            {albums.slice(0, 5).map((item, i) => (
              <div
                key={item.albumId || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  background: i === 0 ? '#131e2c' : 'transparent',
                  borderRadius: 12,
                  padding: i === 0 ? '12px 16px' : '4px 8px',
                  border: i === 0 ? '1px solid #7cc7e840' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    fontSize: i === 0 ? 28 : 22,
                    fontWeight: 700,
                    color: i === 0 ? '#7cc7e8' : '#64748b',
                  }}
                >
                  {item.rank}
                </div>
                {item.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cover}
                    width={i === 0 ? 72 : 56}
                    height={i === 0 ? 72 : 56}
                    style={{ borderRadius: 8, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: i === 0 ? 72 : 56,
                      height: i === 0 ? 72 : 56,
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
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: i === 0 ? 26 : 20,
                      color: '#f0f9ff',
                      fontWeight: 600,
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 16, color: '#64748b' }}>
                    {item.artist}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#7cc7e8',
                  }}
                >
                  ×{item.count}
                </div>
              </div>
            ))}
            {albums.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 22 }}>
                No listens this month
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 28,
              borderTop: '1px solid #2a3645',
              paddingTop: 20,
            }}
          >
            <div style={{ fontSize: 20, color: '#7cc7e8', fontWeight: 700 }}>
              Tornamesa
            </div>
            <div style={{ fontSize: 16, color: '#475569' }}>
              tornamesa.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1350, // story-friendly 4:5
      }
    );
  } catch (err) {
    console.error('Wrapped OG error:', err);
    return new Response(err.message || 'Error', { status: 500 });
  }
}
