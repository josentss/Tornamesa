import { ImageResponse } from 'next/og';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canViewWithFollows } from '@/lib/visibilityAccess';
import { localDateKey, normalizeTimeZone } from '@/lib/timezone';
import { buildYearTopRanges, toTopRpcRanges } from '@/lib/topRanges';
import { clientKey, rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const fmt = (value) => new Intl.NumberFormat('en').format(Number(value) || 0);
const clipped = (value, max = 34) => {
  const text = String(value || '');
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
};

function errorResponse(message, status) {
  return new Response(message, { status, headers: NO_STORE });
}

function allowedCover(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      ['i.scdn.co', 'mosaic.scdn.co', 'image-cdn-ak.spotifycdn.com', 'res.cloudinary.com']
        .includes(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

// Album art is optional. Do not follow redirects or fetch arbitrary catalog URLs.
async function coverToDataUrl(url) {
  if (!url || !allowedCover(url)) return null;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
    const size = Number(response.headers.get('content-length') || 0);
    if (size > 2_000_000) return null;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 2_000_000) return null;
    return 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
}

function AlbumCover({ item, size }) {
  return item.cover ? (
    <img src={item.cover} alt="" width={size} height={size}
      style={{ width: size, height: size, borderRadius: 14, objectFit: 'cover' }} />
  ) : (
    <div style={{ width: size, height: size, display: 'flex', borderRadius: 14,
      background: '#243449', border: '1px solid #324860', alignItems: 'center',
      justifyContent: 'center', color: '#7b91a6', fontSize: 18 }}>T</div>
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  const requestedYear = searchParams.get('year');

  if (!username || username.length > 100) return errorResponse('Invalid username', 400);
  if (requestedYear !== null &&
    (!/^\d{4}$/.test(requestedYear) ||
     Number(requestedYear) < 1900 || Number(requestedYear) > 2100)) {
    return errorResponse('Invalid year', 400);
  }

  try {
    const viewer = await getRequestUser(request);
    const supabase = createSupabaseServer();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, is_private, diary_public, timezone')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return errorResponse('User not found', 404);

    if (!await canViewWithFollows(supabase, viewer, profile, 'top')) {
      return errorResponse('This top is private', 403);
    }

    const tz = normalizeTimeZone(profile.timezone || 'UTC');
    const year = requestedYear === null
      ? Number(localDateKey(new Date(), tz).slice(0, 4))
      : Number(requestedYear);

    const quota = await rateLimit(
      clientKey(request, 'yearly-image', viewer?.id),
      { limit: 8, windowMs: 60_000, name: 'yearly-image' }
    );
    if (!quota.ok) {
      const limited = rateLimitResponse(quota.retryAfterSec);
      limited.headers.set('Cache-Control', 'private, no-store');
      return limited;
    }

    // Same ranking and statistics RPCs as Yearly Top; only the display limit is five.
    const ranges = toTopRpcRanges(buildYearTopRanges(year, tz));
    const [top, stats] = await Promise.all([
      supabase.rpc('top_albums', {
        p_user_id: profile.id,
        p_ranges: ranges,
        p_sort: 'listens',
        p_min_listens: 1,
        p_min_rating: null,
        p_limit: 5,
        p_artist: null,
      }),
      supabase.rpc('yearly_top_stats', {
        p_user_id: profile.id, p_year: year,
      }),
    ]);
    if (top.error || stats.error || !stats.data || typeof stats.data !== 'object') {
      throw top.error || stats.error || new Error('Invalid yearly stats');
    }

    const ids = (top.data || []).map((item) => item.album_id);
    const metadata = {};
    if (ids.length > 0) {
      const { data: albums, error: albumError } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .in('spotify_id', ids);
      if (albumError) throw albumError;
      for (const album of albums || []) metadata[album.spotify_id] = album;
    }

    const items = await Promise.all((top.data || []).map(async (item) => {
      const album = metadata[item.album_id];
      return {
        title: clipped(album?.title || 'Unknown album', 46),
        artist: clipped(album?.artist || '', 40),
        count: Number(item.listen_count) || 0,
        cover: await coverToDataUrl(album?.cover_url),
      };
    }));

    const summary = stats.data;
    const monthly = Array.isArray(summary.monthly) ? summary.monthly : [];
    const peak = monthly.reduce((best, item) => (
      Number(item.listens) > Number(best?.listens || 0) ? item : best
    ), null);
    const topArtist = Array.isArray(summary.topArtists) ? summary.topArtists[0] : null;
    const winner = items[0];
    const others = items.slice(1);

    return new ImageResponse(
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        background: '#0a0f16', color: '#f0f9ff', padding: 56,
        fontFamily: 'sans-serif',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 19, color: '#7cc7e8', letterSpacing: 3, fontWeight: 700 }}>
              YEARLY TOP
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, marginTop: 6 }}>{year}</div>
            <div style={{ fontSize: 22, color: '#9bacbd' }}>
              @{clipped(profile.username, 30)}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: '#7cc7e8' }}>
            Tornamesa
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          background: '#131e2c', border: '1px solid #2a3645', borderRadius: 22,
          padding: '28px 32px', marginBottom: 30,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#91a4b8', fontSize: 20 }}>Your year in albums</div>
            <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.1 }}>
              {fmt(summary.totalListens)}
            </div>
            <div style={{ color: '#9bacbd', fontSize: 20 }}>album listens</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16,
            alignItems: 'flex-end', paddingBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {fmt(summary.uniqueAlbums)} <span style={{ color: '#91a4b8', fontSize: 17, fontWeight: 400 }}>albums</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {fmt(summary.uniqueArtists)} <span style={{ color: '#91a4b8', fontSize: 17, fontWeight: 400 }}>artists</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ color: '#7cc7e8', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            YOUR #1 ALBUM
          </div>
          {winner ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 24,
              borderRadius: 20, padding: 22, background: '#131e2c',
              border: '1px solid #3a6078', marginBottom: 24,
            }}>
              <AlbumCover item={winner} size={174} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 9 }}>
                <div style={{ fontSize: 31, fontWeight: 700 }}>
                  {clipped(winner.title, 32)}
                </div>
                <div style={{ fontSize: 20, color: '#9bacbd' }}>
                  {clipped(winner.artist, 37)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#7cc7e8' }}>
                  ×{fmt(winner.count)} listens
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', padding: 42, background: '#131e2c',
              borderRadius: 20, color: '#9bacbd', marginBottom: 24,
              fontSize: 22,
            }}>No albums logged this year</div>
          )}
          <div style={{ color: '#91a4b8', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            TOP ALBUMS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {others.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16, height: 79,
                padding: '6px 14px', borderBottom: '1px solid #243449',
              }}>
                <div style={{ width: 32, fontSize: 25, color: '#7cc7e8', fontWeight: 700 }}>
                  {i + 2}
                </div>
                <AlbumCover item={item} size={62} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {clipped(item.title, 48)}
                  </div>
                  <div style={{ fontSize: 16, color: '#9bacbd' }}>
                    {clipped(item.artist, 52)}
                  </div>
                </div>
                <div style={{ fontSize: 19, color: '#7cc7e8', fontWeight: 700 }}>
                  ×{fmt(item.count)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 28,
          borderTop: '1px solid #2a3645', paddingTop: 22, marginTop: 28,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{ fontSize: 15, color: '#91a4b8' }}>TOP ARTIST</div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>
              {clipped(topArtist?.name || '—', 30)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{ fontSize: 15, color: '#91a4b8' }}>MOST ACTIVE MONTH</div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>
              {peak && Number(peak.listens) > 0
                ? MONTHS[Number(peak.month) - 1] + ' · ' + fmt(peak.listens)
                : '—'}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', marginTop: 26,
          color: '#586b80', fontSize: 15,
        }}>tornamesa.app</div>
      </div>,
      { width: 1080, height: 1350, headers: NO_STORE }
    );
  } catch (error) {
    console.error('Yearly image error:', error);
    return errorResponse('Failed to generate yearly image', 500);
  }
}
