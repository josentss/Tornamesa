import { ImageResponse } from 'next/og';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { canViewWithFollows } from '@/lib/visibilityAccess';
import { localDateKey, normalizeTimeZone } from '@/lib/timezone';
import { buildYearTopRanges, toTopRpcRanges } from '@/lib/topRanges';
import { clientKey, rateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { YEARLY_CARDS, YEARLY_THEMES, YearlyWrappedCard } from '@/components/yearly/YearlyWrappedCards';

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
  const card = searchParams.get('card') || 'summary';
  const themeName = searchParams.get('theme') || 'night';

  // Validate style parameters before resolving the viewer or owner profile.
  if (!Object.hasOwn(YEARLY_CARDS, card) || !Object.hasOwn(YEARLY_THEMES, themeName)) {
    return errorResponse('Invalid yearly card or theme', 400);
  }

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
    const needsAlbums = card === 'summary' || card === 'album' || card === 'albums';
    const [top, stats] = await Promise.all([
      needsAlbums ? supabase.rpc('top_albums', {
        p_user_id: profile.id,
        p_ranges: ranges,
        p_sort: 'listens',
        p_min_listens: 1,
        p_min_rating: null,
        p_limit: 5,
        p_artist: null,
      }) : Promise.resolve({ data: [], error: null }),
      supabase.rpc('yearly_top_stats', {
        p_user_id: profile.id, p_year: year,
      }),
    ]);
    if (top.error || stats.error || !stats.data || typeof stats.data !== 'object') {
      throw top.error || stats.error || new Error('Invalid yearly stats');
    }

    const selectedAlbums = (top.data || []).slice(0, card === 'album' ? 1 : 5);
    const ids = selectedAlbums.map((item) => item.album_id);
    const metadata = {};
    if (ids.length > 0) {
      const { data: albums, error: albumError } = await supabase
        .from('albums')
        .select('spotify_id, title, artist, cover_url')
        .in('spotify_id', ids);
      if (albumError) throw albumError;
      for (const album of albums || []) metadata[album.spotify_id] = album;
    }

    const items = await Promise.all(selectedAlbums.map(async (item) => {
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
    const palette = YEARLY_THEMES[themeName];
    if (card !== 'summary') {
      const story = new ImageResponse(
        <YearlyWrappedCard
          card={card} theme={themeName} username={profile.username} year={year}
          summary={summary} items={items} topArtists={summary.topArtists || []}
          monthly={monthly}
        />,
        { width: 1080, height: 1920, headers: NO_STORE }
      );
      // Validate with Satori fully before sending bytes, exactly as in summary.
      const storyPng = await story.arrayBuffer();
      return new Response(storyPng, {
        status: 200, headers: { ...NO_STORE, 'Content-Type': 'image/png' },
      });
    }

    // Force PNG rendering inside this try/catch; a streamed ImageResponse
    // otherwise raises Satori errors after the route has returned a 200.
    const image = new ImageResponse(
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        background: palette.bg, color: '#f0f9ff', padding: 70,
        fontFamily: 'sans-serif',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 40,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex',  fontSize: 29, color: palette.accent, letterSpacing: 3, fontWeight: 700 }}>
              YEARLY TOP
            </div>
            <div style={{ display: 'flex',  fontSize: 84, fontWeight: 800, marginTop: 6 }}>{year}</div>
            <div style={{ display: 'flex',  fontSize: 30, color: palette.muted }}>
              {'@' + clipped(profile.username, 30)}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: palette.accent }}>
            Tornamesa
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          background: palette.surface, border: '1px solid #2a3645', borderRadius: 22,
          padding: '36px 40px', marginBottom: 38,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex',  color: palette.muted, fontSize: 28 }}>Your year in albums</div>
            <div style={{ display: 'flex',  fontSize: 136, fontWeight: 800, lineHeight: 1.1 }}>
              {fmt(summary.totalListens)}
            </div>
            <div style={{ display: 'flex',  color: palette.muted, fontSize: 28 }}>album listens</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16,
            alignItems: 'flex-end', paddingBottom: 8 }}>
            {/* Every div declares a layout; Satori splits even mixed text/expression nodes. */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 39, fontWeight: 700 }}>
              {fmt(summary.uniqueAlbums)} <span style={{ color: palette.muted, fontSize: 25, fontWeight: 400 }}>albums</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 39, fontWeight: 700 }}>
              {fmt(summary.uniqueArtists)} <span style={{ color: palette.muted, fontSize: 25, fontWeight: 400 }}>artists</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex',  color: palette.accent, fontSize: 27, fontWeight: 700, marginBottom: 12 }}>
            YOUR #1 ALBUM
          </div>
          {winner ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 26,
              borderRadius: 20, padding: 25, background: palette.surface,
              border: '1px solid #3a6078', marginBottom: 24,
            }}>
              <AlbumCover item={winner} size={278} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 9 }}>
                <div style={{ display: 'flex',  fontSize: 47, fontWeight: 700 }}>
                  {clipped(winner.title, 32)}
                </div>
                <div style={{ display: 'flex',  fontSize: 30, color: palette.muted }}>
                  {clipped(winner.artist, 37)}
                </div>
                <div style={{ display: 'flex',  fontSize: 34, fontWeight: 700, color: palette.accent }}>
                  {'×' + fmt(winner.count) + ' listens'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', padding: 42, background: palette.surface,
              borderRadius: 20, color: palette.muted, marginBottom: 24,
              fontSize: 22,
            }}>No albums logged this year</div>
          )}
          <div style={{ display: 'flex',  color: palette.muted, fontSize: 27, fontWeight: 700, marginBottom: 12 }}>
            TOP ALBUMS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {others.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 20, height: 143,
                padding: '6px 14px', borderBottom: '1px solid #243449',
              }}>
                <div style={{ display: 'flex',  width: 40, fontSize: 37, color: palette.accent, fontWeight: 700 }}>
                  {i + 2}
                </div>
                <AlbumCover item={item} size={111} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
                  <div style={{ display: 'flex',  fontSize: 32, fontWeight: 700 }}>
                    {clipped(item.title, 48)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', fontSize: 25, color: palette.muted }}>
                      {clipped(item.artist, 33)}
                    </div>
                    <div style={{ display: 'flex', fontSize: 28, color: palette.accent, fontWeight: 700 }}>
                      {'×' + fmt(item.count)}
                    </div>
                  </div>
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
            <div style={{ display: 'flex',  fontSize: 23, color: palette.muted }}>TOP ARTIST</div>
            <div style={{ display: 'flex',  fontSize: 32, fontWeight: 700 }}>
              {clipped(topArtist?.name || '—', 30)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{ display: 'flex',  fontSize: 23, color: palette.muted }}>MOST ACTIVE MONTH</div>
            <div style={{ display: 'flex',  fontSize: 32, fontWeight: 700 }}>
              {peak && Number(peak.listens) > 0
                ? MONTHS[Number(peak.month) - 1] + ' · ' + fmt(peak.listens)
                : '—'}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', marginTop: 26,
          color: palette.muted, fontSize: 23,
        }}>tornamesa.app</div>
      </div>,
      { width: 1080, height: 1920, headers: NO_STORE }
    );
    const png = await image.arrayBuffer();
    return new Response(png, {
      status: 200,
      headers: { ...NO_STORE, 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error('Yearly image render error:', error);
    return errorResponse('Failed to generate yearly image', 500);
  }
}
