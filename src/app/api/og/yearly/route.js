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

// Only immutable, public Spotify artwork is cached in this warm process.
// Never store Cloudinary assets, user data, or rendered private PNGs here.
const publicArtwork = new Map();
const ARTWORK_LIMIT = 12;
const ARTWORK_TTL = 5 * 60_000;

function publicArtworkKey(url) {
  const parsed = new URL(url);
  return parsed.hostname === 'i.scdn.co' && !parsed.port && !parsed.search &&
    !parsed.hash && /^\/image\/[a-f0-9]+$/i.test(parsed.pathname) ? parsed.href : null;
}

// Album art is optional. Do not follow redirects or fetch arbitrary catalog URLs.
async function coverToDataUrl(url) {
  if (!url || !allowedCover(url)) return null;
  try {
    const key = publicArtworkKey(url);
    const cached = key && publicArtwork.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;
    if (key && cached) publicArtwork.delete(key);
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
    const data = 'data:' + mime + ';base64,' + Buffer.from(bytes).toString('base64');
    if (key) {
      if (publicArtwork.size >= ARTWORK_LIMIT && !publicArtwork.has(key)) {
        publicArtwork.delete(publicArtwork.keys().next().value);
      }
      publicArtwork.set(key, { data, expires: Date.now() + ARTWORK_TTL });
    }
    return data;
  } catch {
    return null;
  }
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

    const selectedAlbums = (top.data || []).slice(0, card === 'albums' ? 5 : 1);
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
    // Materialize all five cards through the same protected renderer.
    const image = new ImageResponse(
      <YearlyWrappedCard card={card} theme={themeName} username={profile.username} year={year}
        summary={summary} items={items}
        topArtists={Array.isArray(summary.topArtists) ? summary.topArtists : []} monthly={monthly} />,
      { width: 1080, height: 1920, headers: NO_STORE }
    );
    const png = await image.arrayBuffer();
    return new Response(png, {
      status: 200, headers: { ...NO_STORE, 'Content-Type': 'image/png' },
    });
  } catch (error) {
    console.error('Yearly image render error:', error);
    return errorResponse('Failed to generate yearly image', 500);
  }
}
