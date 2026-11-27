// Yearly Wrapped story cards. Only existing yearly_top_stats and top_albums data.
// Keep Satori-compatible styles: explicit display on every container.
export const YEARLY_THEMES = Object.freeze({
  night: { label: 'Night', bg: '#0a0f16', surface: '#131e2c', border: '#2a3645', accent: '#7cc7e8', muted: '#9bacbd', text: '#f0f9ff', shade: '#183143' },
  ocean: { label: 'Ocean', bg: '#0b1520', surface: '#152a3a', border: '#2e5260', accent: '#81cfc6', muted: '#a3c8c8', text: '#f0faf9', shade: '#1b4350' },
  violet: { label: 'Violet', bg: '#131322', surface: '#241e37', border: '#4b3c66', accent: '#b7b1e8', muted: '#c0b4d6', text: '#f5f1ff', shade: '#40305e' },
  moss: { label: 'Moss', bg: '#0d1715', surface: '#182821', border: '#354b41', accent: '#a8c6a4', muted: '#afc2b8', text: '#f0f9ff', shade: '#2b4135' },
});

export const YEARLY_CARDS = Object.freeze({
  summary: 'Year in review',
  album: 'Album of the year',
  albums: 'Top five albums',
  artists: 'Top five artists',
  insights: 'The year in numbers',
});

// Shared editorial frame: every story fits the same safe area.
// 1920 - 224 vertical padding - 90 header - 44 gap - 54 gap - 88 footer = 1420.
export const STORY_LAYOUT = Object.freeze({ width: 1080, height: 1920, paddingX: 80, paddingY: 112,
  header: 90, headerGap: 44, body: 1420, footerGap: 54, footer: 88 });
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = value => new Intl.NumberFormat('en').format(Number(value) || 0);
const shorten = (value, max = 40) => {
  const chars = Array.from(String(value || ''));
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : chars.join('');
};
const numSize = value => fmt(value).length > 6 ? 112 : fmt(value).length > 4 ? 148 : 196;

// Explicit dimensions, line boxes and no shrinking: the old summary overflowed
// because it tried to squeeze the entire top five into a flex:1 column.
function Text({ children, size = 32, color, weight = 400, width, lines = 1, align = 'left' }) {
  return <div style={{ display: 'flex', flexShrink: 0, width, height: Math.ceil(size * 1.24 * lines),
    fontSize: size, lineHeight: 1.24, fontWeight: weight, color, overflow: 'hidden',
    textAlign: align, justifyContent: align === 'center' ? 'center' : 'flex-start',
    textOverflow: 'ellipsis', whiteSpace: lines === 1 ? 'nowrap' : 'normal', lineClamp: lines }}>
    {children}
  </div>;
}
function Cover({ item, size, theme }) {
  return item?.cover ? (
    <img src={item.cover} alt="" width={size} height={size}
      style={{ width: size, height: size, flexShrink: 0, objectFit: 'cover', borderRadius: 12 }} />
  ) : (
    <div style={{ display: 'flex', flexShrink: 0, width: size, height: size,
      background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', color: theme.accent, fontSize: 34 }}>No cover</div>
  );
}
function Rule({ theme }) {
  return <div style={{ display: 'flex', height: 2, flexShrink: 0, background: theme.border }} />;
}
function Label({ children, theme }) {
  return <Text size={27} color={theme.accent} weight={700}>{children}</Text>;
}
function Frame({ card, year, username, theme, children }) {
  const l = STORY_LAYOUT;
  return (
    <div style={{ display: 'flex', width: l.width, height: l.height, flexDirection: 'column',
      background: theme.bg, color: theme.text, padding: l.paddingY + 'px ' + l.paddingX + 'px',
      fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: l.header, flexShrink: 0,
        justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: l.headerGap }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: 610 }}>
          <Text size={27} color={theme.accent} weight={700}>{'YEARLY TOP / ' + year}</Text>
          <Text size={27} color={theme.muted}>{'@' + shorten(username, 26)}</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <Text size={34} weight={700}>Tornamesa</Text>
          <div style={{ display: 'flex', width: 62, height: 5, background: theme.accent }} />
        </div>
      </div>
      <div style={{ display: 'flex', height: l.body, flexShrink: 0, flexDirection: 'column',
        justifyContent: 'center', overflow: 'hidden' }}>{children}</div>
      <div style={{ display: 'flex', height: l.footer, flexShrink: 0, marginTop: l.footerGap,
        flexDirection: 'column', gap: 18 }}>
        <Rule theme={theme} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text size={25} color={theme.accent}>{YEARLY_CARDS[card]}</Text>
          <Text size={25} color={theme.muted}>tornamesa.app</Text>
        </div>
      </div>
    </div>
  );
}
function Empty({ theme, title }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <Label theme={theme}>YOUR YEAR IN MUSIC</Label>
    <Text size={62} lines={2} weight={700}>{title}</Text>
    <Text size={32} color={theme.muted}>No listening activity recorded yet.</Text>
  </div>;
}
function Summary({ summary, items, artists, theme }) {
  const first = items[0];
  const topArtist = artists[0];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label theme={theme}>YOUR YEAR IN ALBUMS</Label>
      <Text size={numSize(summary.totalListens)} weight={800} color={theme.text}>{fmt(summary.totalListens)}</Text>
      <Text size={38} color={theme.muted}>Album listens</Text>
    </div>
    <Rule theme={theme} />
    <div style={{ display: 'flex', gap: 32 }}>
      {[[summary.uniqueAlbums,'Different albums'],[summary.uniqueArtists,'Artists']].map(([n,label]) =>
        <div key={label} style={{ display: 'flex', width: 444, flexDirection: 'column', gap: 6 }}>
          <Text size={82} weight={700} color={theme.accent}>{fmt(n)}</Text>
          <Text size={30} color={theme.muted}>{label}</Text>
        </div>)}
    </div>
    {first ? <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Label theme={theme}>YOUR ALBUM OF THE YEAR</Label>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, background: theme.surface,
        borderRadius: 18, flexShrink: 0 }}>
        <Cover item={first} size={340} theme={theme} />
        <div style={{ display: 'flex', width: 490, flexDirection: 'column', gap: 10 }}>
          <Text size={48} lines={2} weight={700}>{shorten(first.title, 46)}</Text>
          <Text size={32} lines={2} color={theme.muted}>{shorten(first.artist, 40)}</Text>
          <Text size={36} weight={700} color={theme.accent}>{fmt(first.count) + ' listens'}</Text>
        </div>
      </div>
    </div> : <Text size={33} color={theme.muted}>No albums logged this year</Text>}
    {topArtist && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Rule theme={theme} />
      <Label theme={theme}>MOST LISTENED ARTIST</Label>
      <Text size={48} weight={700}>{shorten(topArtist.name, 36)}</Text>
      <Text size={30} color={theme.muted}>{fmt(topArtist.listens) + ' album listens'}</Text>
    </div>}
  </div>;
}
function AlbumSpotlight({ items, theme }) {
  const first = items[0];
  if (!first) return <Empty theme={theme} title="Your album of the year" />;
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
    <Label theme={theme}>YOUR MOST LISTENED ALBUM</Label>
    <Cover item={first} size={760} theme={theme} />
    <div style={{ display: 'flex', flexDirection: 'column', width: 900, alignItems: 'center', gap: 6 }}>
      <Text size={64} lines={2} weight={700} align="center" width={900}>{shorten(first.title, 50)}</Text>
      <Text size={37} color={theme.muted} align="center" width={900}>{shorten(first.artist, 48)}</Text>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <Text size={110} color={theme.accent} weight={800}>{fmt(first.count)}</Text>
      <Text size={36} color={theme.muted}>Album listens</Text>
    </div>
  </div>;
}
function AlbumsRanking({ items, theme }) {
  if (!items.length) return <Empty theme={theme} title="Your top albums" />;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
    <Label theme={theme}>THE RECORDS YOU PLAYED MOST</Label>
    <Text size={66} weight={700}>Your top albums</Text>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.slice(0, 5).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', height: 222, flexShrink: 0,
          gap: 22, padding: '12px 0', borderBottom: '1px solid ' + theme.border }}>
          <Text size={46} weight={700} width={58} color={theme.accent}>{String(i + 1).padStart(2,'0')}</Text>
          <Cover item={item} size={182} theme={theme} />
          <div style={{ display: 'flex', flexDirection: 'column', width: 636, gap: 5 }}>
            <Text size={39} weight={700} lines={2}>{shorten(item.title, 54)}</Text>
            <Text size={29} color={theme.muted}>{shorten(item.artist, 40)}</Text>
            <Text size={31} color={theme.accent} weight={700}>{fmt(item.count) + ' listens'}</Text>
          </div>
        </div>
      ))}
    </div>
  </div>;
}
function ArtistsRanking({ artists, theme }) {
  const leaders = artists.slice(0, 5);
  if (!leaders.length) return <Empty theme={theme} title="Your top artists" />;
  const first = leaders[0];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <Label theme={theme}>THE ARTISTS BEHIND YOUR YEAR</Label>
    <Text size={66} weight={700}>Your top artists</Text>
    <div style={{ display: 'flex', flexDirection: 'column', padding: 34,
      background: theme.surface, borderLeft: '6px solid ' + theme.accent, gap: 8 }}>
      <Label theme={theme}>01 / MOST LISTENED</Label>
      <Text size={64} lines={2} weight={700}>{shorten(first.name, 42)}</Text>
      <Text size={45} weight={700} color={theme.accent}>{fmt(first.listens) + ' album listens'}</Text>
      {first.albums != null && <Text size={30} color={theme.muted}>{fmt(first.albums) + ' different albums'}</Text>}
    </div>
    {leaders.slice(1).map((artist, i) => (
      <div key={i} style={{ display: 'flex', height: 164, flexShrink: 0, gap: 24,
        alignItems: 'center', borderBottom: '1px solid ' + theme.border }}>
        <Text size={43} color={theme.accent} width={65}>{String(i+2).padStart(2,'0')}</Text>
        <div style={{ display: 'flex', flexDirection: 'column', width: 826, gap: 7 }}>
          <Text size={43} weight={700}>{shorten(artist.name, 40)}</Text>
          <Text size={31} color={theme.muted}>{fmt(artist.listens) + ' listens' +
            (artist.albums != null ? '  ·  ' + fmt(artist.albums) + ' albums' : '')}</Text>
        </div>
      </div>
    ))}
  </div>;
}
function Insights({ summary, monthly, theme }) {
  const entries = Array.from({length:12}, (_,i) => monthly.find(m => Number(m.month) === i+1) || { month:i+1, listens:0 });
  const peak = entries.reduce((best,m) => Number(m.listens) > Number(best?.listens || 0) ? m : best, null);
  const max = Math.max(1, ...entries.map(m => Number(m.listens) || 0));
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
    <Label theme={theme}>YOUR LISTENING PATTERNS</Label>
    <Text size={66} weight={700}>A year in numbers</Text>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text size={31} color={theme.muted}>Most active month</Text>
      <Text size={100} weight={800} color={theme.accent}>{peak ? months[Number(peak.month)-1] : '—'}</Text>
      <Text size={38}>{peak ? fmt(peak.listens) + ' album listens' : 'No listens this year'}</Text>
    </div>
    <Rule theme={theme} />
    <div style={{ display: 'flex', gap: 24 }}>
      {[[summary.discoveries, 'First-time albums'],[summary.repeatListens, 'Repeat listens']].map(([n,label]) =>
        <div key={label} style={{ display: 'flex', flexDirection: 'column', width: 448, gap: 8 }}>
          <Text size={94} weight={700} color={theme.accent}>{fmt(n)}</Text>
          <Text size={30} color={theme.muted}>{label}</Text>
        </div>)}
    </div>
    <Rule theme={theme} />
    <Text size={31} color={theme.muted}>Album listens by month</Text>
    <div style={{ display: 'flex', height: 300, flexShrink: 0, alignItems: 'flex-end', gap: 8 }}>
      {entries.map((item,i) => <div key={i} style={{ display: 'flex', flexDirection: 'column',
        width: 69, alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', height: 250, width: 48, justifyContent: 'flex-end', flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: 48, borderRadius: 4,
            height: Math.round(250 * (Number(item.listens)||0) / max),
            background: peak && item.month === peak.month ? theme.accent : theme.shade }} />
        </div>
        <Text size={23} color={theme.muted}>{shortMonths[i]}</Text>
      </div>)}
    </div>
  </div>;
}
export function YearlyWrappedCard({ card, theme, username, year, summary,
  items = [], topArtists = [], monthly = [] }) {
  const colors = YEARLY_THEMES[theme] || YEARLY_THEMES.night;
  return <Frame card={card} year={year} username={username} theme={colors}>
    {card === 'summary' ? <Summary summary={summary} items={items} artists={topArtists} theme={colors} />
      : card === 'album' ? <AlbumSpotlight items={items} theme={colors} />
      : card === 'albums' ? <AlbumsRanking items={items} theme={colors} />
      : card === 'artists' ? <ArtistsRanking artists={topArtists} theme={colors} />
      : <Insights summary={summary} monthly={monthly} theme={colors} />}
  </Frame>;
}
