// Monthly Top share image (1080×1920), drawn in the browser with canvas.
// Shares colors and type with the Yearly Wrapped cards.
const W = 1080;
const H = 1920;
const PAD = 80;
const INNER = W - PAD * 2;
const FAMILY = 'TornamesaInter, TornamesaInterExt, system-ui, sans-serif';

let fontsReady = null;

// A font that fails to load falls back to the system face; the image still renders.
function loadFonts() {
  if (fontsReady) return fontsReady;
  const faces = [];
  for (const [subset, family] of [['latin', 'TornamesaInter'], ['latin-ext', 'TornamesaInterExt']]) {
    for (const weight of ['400', '600', '800']) {
      faces.push(new FontFace(family, `url(/fonts/inter-${subset}-${weight}-normal.woff)`, { weight }));
    }
  }
  fontsReady = Promise.all(faces.map((face) => face.load().then((f) => document.fonts.add(f))))
    .catch(() => { fontsReady = null; });
  return fontsReady;
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const fmt = (value) => new Intl.NumberFormat('en').format(Number(value) || 0);
const word = (count, noun) => (Number(count) === 1 ? noun : noun + 's');

function font(ctx, size, weight = 400, tracking = 0) {
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  // Not supported by every browser; without it the text is just slightly wider.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
}

function ellipsize(ctx, text, maxWidth) {
  const chars = Array.from(String(text || ''));
  if (ctx.measureText(chars.join('')).width <= maxWidth) return chars.join('');
  while (chars.length && ctx.measureText(chars.join('').trimEnd() + '…').width > maxWidth) chars.pop();
  return chars.join('').trimEnd() + '…';
}

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  while (words.length && lines.length < maxLines - 1) {
    let line = words.shift();
    while (words.length && ctx.measureText(line + ' ' + words[0]).width <= maxWidth) {
      line += ' ' + words.shift();
    }
    lines.push(ellipsize(ctx, line, maxWidth));
  }
  if (words.length) lines.push(ellipsize(ctx, words.join(' '), maxWidth));
  return lines;
}

function write(ctx, text, x, y, { size, weight = 400, color, tracking = 0, align = 'left', max }) {
  font(ctx, size, weight, tracking);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(max ? ellipsize(ctx, text, max) : text, x, y);
}

// Largest size (down to 60%) at which the text fits the given width.
function fitSize(ctx, text, size, weight, maxWidth) {
  let current = size;
  font(ctx, current, weight);
  while (current > size * 0.6 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    font(ctx, current, weight);
  }
  return current;
}

function box(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function circle(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function vinyl(ctx, x, y, radius, theme) {
  circle(ctx, x, y, radius, '#05080c', theme.border);
  for (const scale of [0.92, 0.82, 0.7, 0.58, 0.46]) {
    circle(ctx, x, y, radius * scale, '#05080c', '#2a3645');
  }
  circle(ctx, x, y, radius * 0.34, theme.accent);
  circle(ctx, x, y, radius * 0.05, theme.bg);
}

function cover(ctx, image, x, y, size, radius, theme) {
  box(ctx, x, y, size, size, radius, theme.shade);
  if (!image) {
    write(ctx, 'No cover', x + size / 2, y + size / 2 + size * 0.04,
      { size: Math.round(size * 0.12), color: theme.accent, align: 'center' });
    return;
  }
  // Center crop, so non-square artwork is not stretched.
  const side = Math.min(image.width, image.height);
  ctx.save();
  box(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side,
    x, y, size, size);
  ctx.restore();
}

export async function generateMonthlyWrappedPng({
  username, title, subtitle, totalListens, uniqueAlbums, uniqueArtists, albums, theme,
}) {
  const list = (albums || []).slice(0, 5);
  const [covers] = await Promise.all([
    Promise.all(list.map((item) => loadImage(item.cover))),
    loadFonts(),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  write(ctx, 'Tornamesa', PAD, 142, { size: 40, weight: 800, color: theme.text, tracking: -1 });
  font(ctx, 22, 800, 3);
  const pillWidth = ctx.measureText('MONTHLY TOP').width + 56;
  box(ctx, W - PAD - pillWidth, 98, pillWidth, 60, 30);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  write(ctx, 'MONTHLY TOP', W - PAD - pillWidth + 28, 136,
    { size: 22, weight: 800, color: theme.accent, tracking: 3 });

  write(ctx, title, PAD, 300,
    { size: fitSize(ctx, title, 104, 800, INNER), weight: 800, color: theme.text, tracking: -3 });
  write(ctx, subtitle, PAD, 356, { size: 36, color: theme.muted });

  // Totals
  const tileW = (INNER - 48) / 3;
  [
    [totalListens, word(totalListens, 'listen')],
    [uniqueAlbums, word(uniqueAlbums, 'album')],
    [uniqueArtists, word(uniqueArtists, 'artist')],
  ].forEach(([value, label], i) => {
    const x = PAD + i * (tileW + 24);
    box(ctx, x, 400, tileW, 168, 32, i === 0 ? theme.accent : theme.surface);
    const text = fmt(value);
    write(ctx, text, x + 32, 494, { size: fitSize(ctx, text, 76, 800, tileW - 64), weight: 800,
      color: i === 0 ? theme.bg : theme.text });
    write(ctx, label, x + 32, 536, { size: 28, weight: i === 0 ? 600 : 400,
      color: i === 0 ? theme.bg : theme.muted });
  });

  if (!list.length) {
    vinyl(ctx, W / 2, 1050, 270, theme);
    write(ctx, 'No listens in this period', W / 2, 1430,
      { size: 52, weight: 800, color: theme.text, align: 'center' });
  } else {
    // Number one
    const first = list[0];
    // Center the ranking when there are fewer than five albums.
    const offset = (5 - list.length) * 92;
    const heroY = 592 + offset;
    box(ctx, PAD, heroY, INNER, 440, 40, theme.surface);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    cover(ctx, covers[0], PAD + 32, heroY + 32, 376, 24, theme);

    const textX = PAD + 444;
    const textW = INNER - 444 - 32;
    write(ctx, String(first.rank ?? 1), textX, heroY + 128,
      { size: 110, weight: 800, color: theme.accent });
    font(ctx, 52, 800, -1);
    const lines = wrap(ctx, first.title || 'Unknown album', textW, 2);
    let y = heroY + 208;
    for (const line of lines) {
      write(ctx, line, textX, y, { size: 52, weight: 800, color: theme.text, tracking: -1 });
      y += 60;
    }
    write(ctx, first.artist || '', textX, y - 8, { size: 30, color: theme.muted, max: textW });
    write(ctx, `${fmt(first.count)} ${word(first.count, 'listen')}`, textX, heroY + 396,
      { size: 34, weight: 800, color: theme.accent, max: textW });

    // Two to five
    list.slice(1).forEach((item, i) => {
      const rowY = 1056 + offset + i * 184;
      const mid = rowY + 84;
      box(ctx, PAD, rowY, INNER, 168, 32, theme.surface);
      write(ctx, String(item.rank ?? i + 2), PAD + 32, mid + 17,
        { size: 48, weight: 800, color: theme.accent });
      cover(ctx, covers[i + 1], PAD + 104, rowY + 16, 136, 16, theme);
      const x = PAD + 268;
      write(ctx, item.title || 'Unknown album', x, mid - 4,
        { size: 36, weight: 800, color: theme.text, max: 480 });
      write(ctx, item.artist || '', x, mid + 38, { size: 30, color: theme.muted, max: 480 });
      const count = fmt(item.count);
      write(ctx, count, W - PAD - 32, mid + 2, { size: fitSize(ctx, count, 48, 800, 124),
        weight: 800, color: theme.text, align: 'right' });
      write(ctx, word(item.count, 'listen'), W - PAD - 32, mid + 38,
        { size: 24, color: theme.muted, align: 'right' });
    });
  }

  // Footer
  write(ctx, `@${username}`, PAD, 1840, { size: 28, weight: 600, color: theme.text, max: 600 });
  write(ctx, 'tornamesa.app', W - PAD, 1840, { size: 28, color: theme.muted, align: 'right' });

  return canvas.toDataURL('image/png');
}
