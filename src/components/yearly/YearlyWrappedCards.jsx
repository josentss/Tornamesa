// Yearly Wrapped story cards. Only existing yearly_top_stats and top_albums data.
// Keep Satori-compatible styles: explicit display on every container.
export const YEARLY_THEMES = Object.freeze({
  night: { label: 'Night', bg: '#0a0f16', surface: '#131e2c', border: '#2a3645', accent: '#7cc7e8', muted: '#9bacbd', text: '#f0f9ff', shade: '#183143' },
  ocean: { label: 'Ocean', bg: '#0b1521', surface: '#152a3a', border: '#2e5260', accent: '#78e1d4', muted: '#a3c8c8', text: '#f0faf9', shade: '#1b4350' },
  violet: { label: 'Violet', bg: '#12101e', surface: '#241e37', border: '#4b3c66', accent: '#bba4ff', muted: '#c0b4d6', text: '#f5f1ff', shade: '#40305e' },
  ember: { label: 'Ember', bg: '#1b1013', surface: '#2d1d25', border: '#684044', accent: '#ffa48b', muted: '#dfb9b2', text: '#fff4f0', shade: '#60302f' },
  forest: { label: 'Forest', bg: '#101810', surface: '#203022', border: '#3a5840', accent: '#b8e18e', muted: '#b9cdb4', text: '#f4fff0', shade: '#335539' },
});

export const YEARLY_CARDS = Object.freeze({
  summary: 'Year in review',
  album: 'Album of the year',
  albums: 'Top five albums',
  artists: 'Top five artists',
  insights: 'The year in numbers',
});

const months = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (value) => new Intl.NumberFormat('en').format(Number(value) || 0);
const shorten = (value, limit = 40) => {
  const s = String(value || '');
  return s.length > limit ? s.slice(0, limit - 1).trimEnd() + '…' : s;
};

function Cover({ item, size, theme }) {
  return item?.cover ? (
    <img src={item.cover} alt="" width={size} height={size}
      style={{ objectFit: 'cover', borderRadius: 16, width: size, height: size }} />
  ) : (
    <div style={{ display: 'flex', background: theme.shade, width: size,
      height: size, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      border: '1px solid ' + theme.border, color: theme.accent, fontSize: 30 }}>
      T
    </div>
  );
}

function Frame({ card, year, username, theme, children }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column',
      background: theme.bg, color: theme.text, padding: '55px 58px', fontFamily: 'sans-serif',
      position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', position: 'absolute', right: -130, top: -180,
        width: 480, height: 480, borderRadius: 260, border: '48px solid ' + theme.shade,
        opacity: 0.9 }} />
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', position: 'relative', marginBottom: 38 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', color: theme.accent, letterSpacing: 3,
            fontSize: 20, fontWeight: 700 }}>YEARLY TOP · {year}</div>
          <div style={{ display: 'flex', color: theme.muted, fontSize: 22 }}>
            {'@' + shorten(username, 30)}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 25, color: theme.text, fontWeight: 700 }}>
          Tornamesa
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        {children}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderTop: '1px solid ' + theme.border,
        paddingTop: 18, marginTop: 24, fontSize: 17 }}>
        <div style={{ display: 'flex', fontWeight: 700, color: theme.accent }}>
          {YEARLY_CARDS[card]}
        </div>
        <div style={{ display: 'flex', color: theme.muted }}>tornamesa.app</div>
      </div>
    </div>
  );
}

function AlbumSpotlight({ items, theme }) {
  const first = items[0];
  if (!first) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', flex: 1, gap: 24 }}>
      <div style={{ display: 'flex', fontSize: 50, color: theme.text }}>Your album of the year</div>
      <div style={{ display: 'flex', color: theme.muted, fontSize: 26 }}>
        No albums logged this year
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 25 }}>
      <div style={{ display: 'flex', fontSize: 26, color: theme.accent, letterSpacing: 2 }}>
        YOUR #1 ALBUM
      </div>
      <div style={{ display: 'flex', padding: 16, background: theme.shade,
        borderRadius: 24, border: '1px solid ' + theme.border }}>
        <Cover item={first} size={455} theme={theme} />
      </div>
      <div style={{ display: 'flex', fontSize: 55, fontWeight: 800,
        textAlign: 'center', marginTop: 12 }}>
        {shorten(first.title, 34)}
      </div>
      <div style={{ display: 'flex', color: theme.muted, fontSize: 29,
        textAlign: 'center' }}>{shorten(first.artist, 42)}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 13,
        marginTop: 24 }}>
        <div style={{ display: 'flex', color: theme.accent,
          fontSize: 85, fontWeight: 800 }}>{fmt(first.count)}</div>
        <div style={{ display: 'flex', color: theme.muted, fontSize: 27 }}>
          album listens</div>
      </div>
    </div>
  );
}

function AlbumsRanking({ items, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', fontSize: 57, fontWeight: 800, marginBottom: 6 }}>
        Your top five albums
      </div>
      <div style={{ display: 'flex', fontSize: 22, color: theme.muted,
        marginBottom: 28 }}>The records you returned to most</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.slice(0, 5).map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 19,
            padding: 16, background: index === 0 ? theme.surface : 'transparent',
            borderRadius: 16, borderBottom: '1px solid ' + theme.border }}>
            <div style={{ display: 'flex', width: 48, fontSize: 31, fontWeight: 800,
              color: theme.accent }}>{index + 1}</div>
            <Cover item={item} size={110} theme={theme} />
            <div style={{ display: 'flex', flexDirection: 'column',
              flex: 1, gap: 9 }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>
                {shorten(item.title, 35)}
              </div>
              <div style={{ display: 'flex', fontSize: 20, color: theme.muted }}>
                {shorten(item.artist, 43)}
              </div>
            </div>
            <div style={{ display: 'flex', color: theme.accent,
              fontSize: 24, fontWeight: 700 }}>{'×' + fmt(item.count)}</div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ display: 'flex', color: theme.muted, fontSize: 27,
            paddingTop: 90 }}>No albums logged this year</div>
        )}
      </div>
    </div>
  );
}

function ArtistsRanking({ artists, theme }) {
  const leaders = (artists || []).slice(0, 5);
  const maxCount = Math.max(1, ...leaders.map((item) => Number(item.listens) || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', fontSize: 59, fontWeight: 800, marginBottom: 8 }}>
        Your top five artists
      </div>
      <div style={{ display: 'flex', color: theme.muted, fontSize: 22,
        marginBottom: 40 }}>By registered album listens</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {leaders.map((artist, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 11,
            paddingBottom: 16, borderBottom: '1px solid ' + theme.border }}>
            <div style={{ display: 'flex', flexDirection: 'row',
              alignItems: 'center', gap: 18 }}>
              <div style={{ display: 'flex', color: theme.accent, fontSize: 36,
                fontWeight: 800, width: 45 }}>{index + 1}</div>
              <div style={{ display: 'flex', fontSize: index === 0 ? 40 : 30,
                fontWeight: 700, flex: 1 }}>{shorten(artist.name, 35)}</div>
              <div style={{ display: 'flex', color: theme.muted, fontSize: 22 }}>
                {fmt(artist.listens)} listens
              </div>
            </div>
            <div style={{ display: 'flex', height: 9, marginLeft: 63,
              background: theme.shade, borderRadius: 9 }}>
              <div style={{ display: 'flex', height: 9,
                background: theme.accent, borderRadius: 9,
                width: Math.max(2, (Number(artist.listens) || 0) / maxCount * 100) + '%' }} />
            </div>
          </div>
        ))}
        {leaders.length === 0 && (
          <div style={{ display: 'flex', color: theme.muted, fontSize: 27,
            paddingTop: 90 }}>No artists logged this year</div>
        )}
      </div>
    </div>
  );
}

function Insights({ summary, monthly, theme }) {
  const entries = Array.from({ length: 12 }, (_, i) =>
    (monthly || []).find((item) => Number(item.month) === i + 1) ||
    { month: i + 1, listens: 0 });
  const peak = entries.reduce((current, item) =>
    Number(item.listens) > Number(current?.listens || 0) ? item : current, null);
  const max = Math.max(1, ...entries.map((item) => Number(item.listens) || 0));
  const hasListens = Number(summary.totalListens) > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', fontSize: 55, fontWeight: 800,
        marginBottom: 35 }}>Your year in numbers</div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: 29,
        background: theme.surface, borderRadius: 22, border: '1px solid ' + theme.border }}>
        <div style={{ display: 'flex', color: theme.muted, fontSize: 21 }}>
          MOST ACTIVE MONTH
        </div>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 800,
          color: theme.accent, marginTop: 10 }}>
          {hasListens && peak ? months[Number(peak.month) - 1] : '—'}
        </div>
        <div style={{ display: 'flex', fontSize: 25, marginTop: 4 }}>
          {hasListens && peak ? fmt(peak.listens) + ' album listens' : 'No listens this year'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, marginTop: 32 }}>
        {[
          { label: 'FIRST-TIME ALBUMS', value: summary.discoveries },
          { label: 'REPEAT LISTENS', value: summary.repeatListens },
        ].map((metric) => (
          <div key={metric.label} style={{ display: 'flex', flex: 1,
            flexDirection: 'column', gap: 10, background: theme.surface,
            borderRadius: 20, padding: 26 }}>
            <div style={{ display: 'flex', fontSize: 17, color: theme.muted }}>
              {metric.label}
            </div>
            <div style={{ display: 'flex', fontSize: 72, color: theme.text,
              fontWeight: 800 }}>{fmt(metric.value)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 21, color: theme.muted,
        marginTop: 50, marginBottom: 20 }}>ALBUM LISTENS BY MONTH</div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-end', gap: 12, height: 188 }}>
        {entries.map((item, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            flex: 1, gap: 11 }}>
            <div style={{ display: 'flex', width: '100%', height: 148,
              alignItems: 'flex-end', justifyContent: 'center', background: theme.surface }}>
              <div style={{ display: 'flex', width: '70%',
                background: Number(item.listens) === max && max > 0 ? theme.accent : theme.shade,
                height: (Number(item.listens) ? Math.max(3, Number(item.listens) / max * 100) : 1) + '%' }} />
            </div>
            <div style={{ display: 'flex', fontSize: 15, color: theme.muted }}>
              {shortMonths[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function YearlyWrappedCard({ card, theme, username, year, summary,
  items = [], topArtists = [], monthly = [] }) {
  const colors = YEARLY_THEMES[theme] || YEARLY_THEMES.night;
  return (
    <Frame card={card} year={year} username={username} theme={colors}>
      {card === 'album'
        ? <AlbumSpotlight items={items} theme={colors} />
        : card === 'albums'
          ? <AlbumsRanking items={items} theme={colors} />
          : card === 'artists'
            ? <ArtistsRanking artists={topArtists} theme={colors} />
            : <Insights summary={summary} monthly={monthly} theme={colors} />}
    </Frame>
  );
}
