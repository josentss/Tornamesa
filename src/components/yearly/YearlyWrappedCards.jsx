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
// 1920 - 192 vertical padding - 64 header - 48 gap - 48 gap - 48 footer = 1520.
export const STORY_LAYOUT = Object.freeze({ width: 1080, height: 1920, paddingX: 80, paddingY: 96,
  header: 64, headerGap: 48, body: 1520, footerGap: 48, footer: 48 });
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WIDTH = 920;
const fmt = value => new Intl.NumberFormat('en').format(Number(value) || 0);
const plural = (value, word) => fmt(value) + ' ' + word + (Number(value) === 1 ? '' : 's');
const shorten = (value, max = 40) => {
  const chars = Array.from(String(value || ''));
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : chars.join('');
};
// Step a display size down as the string grows, so big totals and long names still fit.
const fit = (value, size, chars) => {
  const length = Array.from(String(value)).length;
  return length > chars ? Math.max(Math.round(size * chars / length), Math.round(size * 0.55)) : size;
};

// Text only takes the height it needs (up to `lines`), so short titles leave no holes
// and descenders are never cut.
function Text({ children, size = 32, color, weight = 400, width, lines = 1, align = 'left',
  leading = 1.25, tracking = 0 }) {
  const style = { display: 'flex', flexShrink: 0, fontSize: size, lineHeight: leading,
    fontWeight: weight, letterSpacing: tracking, maxHeight: Math.ceil(size * leading * lines),
    overflow: 'hidden', wordBreak: 'break-word', textAlign: align,
    justifyContent: align === 'center' ? 'center' : 'flex-start' };
  // Satori's CSS parser does not accept undefined style values.
  if (width != null) style.width = width;
  if (color != null) style.color = color;
  return <div style={{ display: 'flex', ...style }}>{children}</div>;
}
// Large headline: negative tracking, like the headings on tornamesa.app.
function Display({ children, size, color, width, lines = 1, align = 'left' }) {
  return <Text size={size} color={color} width={width} lines={lines} align={align}
    weight={800} leading={1.16} tracking={-Math.round(size * 0.035)}>{children}</Text>;
}
function Label({ children, theme, color }) {
  return <Text size={26} color={color || theme.accent} weight={800} tracking={4}>{children}</Text>;
}
function Cover({ item, size, theme, radius = 20 }) {
  return item?.cover ? (
    <img src={item.cover} alt="" width={size} height={size}
      style={{ width: size, height: size, flexShrink: 0, objectFit: 'cover', borderRadius: radius }} />
  ) : (
    <div style={{ display: 'flex', flexShrink: 0, width: size, height: size,
      background: theme.shade, borderRadius: radius, alignItems: 'center',
      justifyContent: 'center', color: theme.accent, fontSize: Math.round(size * 0.13) }}>No cover</div>
  );
}
// The record behind the sleeve: concentric grooves around an accent label.
function Vinyl({ size, theme }) {
  const ring = (diameter, background, border, child) => (
    <div style={{ display: 'flex', flexShrink: 0, width: diameter, height: diameter,
      borderRadius: diameter / 2, background, border: '2px solid ' + border,
      alignItems: 'center', justifyContent: 'center' }}>{child}</div>
  );
  const groove = '#2a3645';
  let disc = ring(Math.round(size * 0.05), theme.bg, theme.bg, null);
  disc = ring(Math.round(size * 0.34), theme.accent, theme.accent, disc);
  for (const scale of [0.46, 0.58, 0.70, 0.82, 0.92]) {
    disc = ring(Math.round(size * scale), '#05080c', groove, disc);
  }
  return ring(size, '#05080c', theme.border, disc);
}
function Tile({ value, label, theme, width = 448 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, flexShrink: 0,
      padding: '30px 36px', background: theme.surface, borderRadius: 32 }}>
      <Display size={fit(fmt(value), 88, 6)}>{fmt(value)}</Display>
      <Text size={28} color={theme.muted}>{label}</Text>
    </div>
  );
}
function Heading({ title, note, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <Display size={76}>{title}</Display>
      <Text size={32} color={theme.muted}>{note}</Text>
    </div>
  );
}
function Frame({ year, username, theme, children }) {
  const l = STORY_LAYOUT;
  return (
    <div style={{ display: 'flex', width: l.width, height: l.height, flexDirection: 'column',
      background: theme.bg, color: theme.text, padding: l.paddingY + 'px ' + l.paddingX + 'px',
      fontFamily: 'Inter, InterExt, sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: l.header, flexShrink: 0, marginBottom: l.headerGap,
        justifyContent: 'space-between', alignItems: 'center' }}>
        <Display size={40}>Tornamesa</Display>
        <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 28px',
          borderRadius: 30, border: '2px solid ' + theme.border }}>
          <Text size={22} weight={800} tracking={3} color={theme.accent}>{'YEARLY TOP ' + year}</Text>
        </div>
      </div>
      <div style={{ display: 'flex', height: l.body, flexShrink: 0, flexDirection: 'column',
        justifyContent: 'center', overflow: 'hidden' }}>{children}</div>
      <div style={{ display: 'flex', height: l.footer, flexShrink: 0, marginTop: l.footerGap,
        justifyContent: 'space-between', alignItems: 'center' }}>
        <Text size={28} weight={600}>{'@' + shorten(username, 26)}</Text>
        <Text size={28} color={theme.muted}>tornamesa.app</Text>
      </div>
    </div>
  );
}
function Empty({ theme, title }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
    <Vinyl size={520} theme={theme} />
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Display size={66} width={WIDTH} lines={2} align="center">{title}</Display>
      <Text size={32} color={theme.muted}>No listening activity recorded yet.</Text>
    </div>
  </div>;
}
function Summary({ summary, items, artists, theme }) {
  const first = items[0];
  const topArtist = artists[0];
  const total = fmt(summary.totalListens);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 56px', borderRadius: 48,
      background: theme.accent, color: theme.bg, flexShrink: 0 }}>
      <Label theme={theme} color={theme.bg}>YOUR YEAR IN ALBUMS</Label>
      <Display size={fit(total, 280, 4)}>{total}</Display>
      <Text size={40} weight={600}>{Number(summary.totalListens) === 1 ? 'album listen' : 'album listens'}</Text>
    </div>
    <div style={{ display: 'flex', gap: 24 }}>
      <Tile value={summary.uniqueAlbums} label="Different albums" theme={theme} />
      <Tile value={summary.uniqueArtists} label="Artists" theme={theme} />
    </div>
    {first ? <div style={{ display: 'flex', alignItems: 'center', gap: 36, padding: 36,
      background: theme.surface, borderRadius: 40, flexShrink: 0 }}>
      <Cover item={first} size={360} theme={theme} />
      <div style={{ display: 'flex', flexDirection: 'column', width: 452, gap: 10 }}>
        <Label theme={theme}>TOP ALBUM</Label>
        <Display size={54} width={452} lines={3}>{shorten(first.title, 42)}</Display>
        <Text size={32} width={452} lines={2} color={theme.muted}>{shorten(first.artist, 36)}</Text>
        <Text size={34} weight={800} color={theme.accent}>{plural(first.count, 'listen')}</Text>
      </div>
    </div> : <div style={{ display: 'flex', padding: 48, background: theme.surface, borderRadius: 40 }}>
      <Text size={34} color={theme.muted}>No albums logged this year</Text>
    </div>}
    {topArtist && <div style={{ display: 'flex', flexDirection: 'column', padding: '36px 40px', gap: 8,
      background: theme.surface, borderRadius: 40, flexShrink: 0 }}>
      <Label theme={theme}>TOP ARTIST</Label>
      <Display size={fit(shorten(topArtist.name, 36), 68, 22)} width={840} lines={2}>{shorten(topArtist.name, 36)}</Display>
      <Text size={32} color={theme.muted}>{plural(topArtist.listens, 'album listen')}</Text>
    </div>}
  </div>;
}
function AlbumSpotlight({ items, theme }) {
  const first = items[0];
  if (!first) return <Empty theme={theme} title="Your album of the year" />;
  const title = shorten(first.title, 50);
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
    <Label theme={theme}>ALBUM OF THE YEAR</Label>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <Vinyl size={660} theme={theme} />
      <div style={{ display: 'flex', marginTop: -330, borderRadius: 28, flexShrink: 0,
        boxShadow: '0 -18px 60px rgba(0,0,0,0.6)' }}>
        <Cover item={first} size={700} radius={28} theme={theme} />
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', width: WIDTH, alignItems: 'center', gap: 4 }}>
      <Display size={fit(title, 84, 20)} width={WIDTH} lines={2} align="center">{title}</Display>
      <Text size={40} color={theme.muted} width={WIDTH} align="center">{shorten(first.artist, 40)}</Text>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', height: 100, padding: '0 52px', borderRadius: 50,
      background: theme.accent, color: theme.bg, flexShrink: 0 }}>
      <Text size={42} weight={800}>{plural(first.count, 'listen')}</Text>
    </div>
  </div>;
}
function AlbumsRanking({ items, theme }) {
  if (!items.length) return <Empty theme={theme} title="Your top albums" />;
  const [first, ...rest] = items.slice(0, 5);
  return <div style={{ display: 'flex', flexDirection: 'column', height: STORY_LAYOUT.body, gap: 20 }}>
    <Heading title="Your top albums" note="The records you played most" theme={theme} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 36, padding: 32, marginTop: 20,
      background: theme.surface, border: '3px solid ' + theme.accent, borderRadius: 40, flexShrink: 0 }}>
      <Cover item={first} size={400} theme={theme} />
      <div style={{ display: 'flex', flexDirection: 'column', width: 414, gap: 8 }}>
        <Display size={110} color={theme.accent}>1</Display>
        <Display size={52} width={414} lines={2}>{shorten(first.title, 28)}</Display>
        <Text size={31} width={414} color={theme.muted}>{shorten(first.artist, 24)}</Text>
        <Text size={34} weight={800} color={theme.accent}>{plural(first.count, 'listen')}</Text>
      </div>
    </div>
    {rest.map((item, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', height: 200, flexShrink: 0,
        gap: 28, padding: '0 32px', background: theme.surface, borderRadius: 32 }}>
        <Text size={48} weight={800} width={44} color={theme.accent}>{String(i + 2)}</Text>
        <Cover item={item} size={152} radius={16} theme={theme} />
        <div style={{ display: 'flex', flexDirection: 'column', width: 458 }}>
          <Text size={36} weight={800} width={458}>{shorten(item.title, 22)}</Text>
          <Text size={30} width={458} color={theme.muted}>{shorten(item.artist, 28)}</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 120, alignItems: 'flex-end' }}>
          <Text size={fit(fmt(item.count), 48, 3)} weight={800}>{fmt(item.count)}</Text>
          <Text size={24} color={theme.muted}>{Number(item.count) === 1 ? 'listen' : 'listens'}</Text>
        </div>
      </div>
    ))}
  </div>;
}
function ArtistsRanking({ artists, theme }) {
  const leaders = artists.slice(0, 5);
  if (!leaders.length) return <Empty theme={theme} title="Your top artists" />;
  const [first, ...rest] = leaders;
  const max = Math.max(1, Number(first.listens) || 0);
  const name = shorten(first.name, 36);
  return <div style={{ display: 'flex', flexDirection: 'column', height: STORY_LAYOUT.body, gap: 20 }}>
    <Heading title="Your top artists" note="Who you kept coming back to" theme={theme} />
    <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 56px', marginTop: 20,
      borderRadius: 48, background: theme.accent, color: theme.bg, flexShrink: 0 }}>
      <Display size={130}>1</Display>
      <Display size={fit(name, 110, 13)} width={808} lines={2}>{name}</Display>
      <Text size={40} weight={600}>{plural(first.listens, 'album listen') +
        (first.albums != null ? ' across ' + plural(first.albums, 'album') : '')}</Text>
    </div>
    {rest.map((artist, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', height: 190, flexShrink: 0,
        gap: 28, padding: '0 36px', background: theme.surface, borderRadius: 32 }}>
        <Text size={48} weight={800} width={44} color={theme.accent}>{String(i + 2)}</Text>
        <div style={{ display: 'flex', flexDirection: 'column', width: 776, gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text size={42} weight={800} width={590}>{shorten(artist.name, 24)}</Text>
            <Text size={42} weight={800}>{fmt(artist.listens)}</Text>
          </div>
          <div style={{ display: 'flex', width: 776, height: 10, borderRadius: 5, background: theme.shade }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, background: theme.accent,
              width: Math.round(776 * Math.min(1, (Number(artist.listens) || 0) / max)) }} />
          </div>
          <Text size={26} color={theme.muted}>{artist.albums != null ? plural(artist.albums, 'album') : 'album listens'}</Text>
        </div>
      </div>
    ))}
  </div>;
}
function Insights({ summary, monthly, theme }) {
  const entries = Array.from({length:12}, (_,i) => monthly.find(m => Number(m.month) === i+1) || { month:i+1, listens:0 });
  const peak = entries.reduce((best,m) => Number(m.listens) > Number(best?.listens || 0) ? m : best, null);
  const max = Math.max(1, ...entries.map(m => Number(m.listens) || 0));
  return <div style={{ display: 'flex', flexDirection: 'column', height: STORY_LAYOUT.body, gap: 24 }}>
    <Heading title="Your year in numbers" note="How your listening moved" theme={theme} />
    <div style={{ display: 'flex', flexDirection: 'column', padding: '44px 56px', marginTop: 16,
      borderRadius: 48, background: theme.accent, color: theme.bg, flexShrink: 0 }}>
      <Text size={32} weight={600}>Most active month</Text>
      <Display size={136}>{peak ? months[Number(peak.month)-1] : 'None yet'}</Display>
      <Text size={36} weight={600}>{peak ? plural(peak.listens, 'album listen') : 'No listens this year'}</Text>
    </div>
    <div style={{ display: 'flex', gap: 24 }}>
      <Tile value={summary.discoveries} label="First-time albums" theme={theme} />
      <Tile value={summary.repeatListens} label="Repeat listens" theme={theme} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 28px', gap: 28,
      background: theme.surface, borderRadius: 40, flexShrink: 0 }}>
      <Text size={32} weight={800}>Album listens by month</Text>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {entries.map((item,i) => {
          const count = Number(item.listens) || 0;
          const isPeak = peak && item.month === peak.month;
          return <div key={i} style={{ display: 'flex', flexDirection: 'column',
            width: 72, alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: 440, width: 72,
              alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {count > 0 && <Text size={fit(fmt(count), 24, 4)} weight={isPeak ? 800 : 400}
                color={isPeak ? theme.accent : theme.muted}>{fmt(count)}</Text>}
              <div style={{ display: 'flex', width: 48, flexShrink: 0, borderRadius: 12,
                height: count > 0 ? Math.max(14, Math.round(390 * count / max)) : 6,
                background: isPeak ? theme.accent : theme.border }} />
            </div>
            <Text size={23} color={theme.muted}>{shortMonths[i]}</Text>
          </div>;
        })}
      </div>
    </div>
  </div>;
}
export function YearlyWrappedCard({ card, theme, username, year, summary,
  items = [], topArtists = [], monthly = [] }) {
  const colors = YEARLY_THEMES[theme] || YEARLY_THEMES.night;
  return <Frame year={year} username={username} theme={colors}>
    {card === 'summary' ? <Summary summary={summary} items={items} artists={topArtists} theme={colors} />
      : card === 'album' ? <AlbumSpotlight items={items} theme={colors} />
      : card === 'albums' ? <AlbumsRanking items={items} theme={colors} />
      : card === 'artists' ? <ArtistsRanking artists={topArtists} theme={colors} />
      : <Insights summary={summary} monthly={monthly} theme={colors} />}
  </Frame>;
}
