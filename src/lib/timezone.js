const TZ_RE = /^[A-Za-z0-9_+\-/]+$/;

export function normalizeTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return 'UTC';
  const t = tz.trim();
  if (t.length > 64 || !TZ_RE.test(t)) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: t }).format(new Date());
    return t;
  } catch {
    return 'UTC';
  }
}

export function clientTimeZone() {
  try {
    return normalizeTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  } catch {
    return 'UTC';
  }
}

function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function localDateKey(isoOrDate, timeZone = 'UTC') {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const p = zonedParts(d, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function zonedLocalToUtc(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = 'UTC'
) {
  const tz = normalizeTimeZone(timeZone);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(new Date(utc), tz);
    const asIfUtc = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    utc += target - asIfUtc;
  }
  return new Date(utc);
}

export function zonedMonthRange(year, month, timeZone = 'UTC') {
  const start = zonedLocalToUtc(year, month, 1, 0, 0, 0, timeZone);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = zonedLocalToUtc(endYear, endMonth, 1, 0, 0, 0, timeZone);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function weekOfMonthInZone(isoDate, timeZone = 'UTC') {
  const key = localDateKey(isoDate, timeZone);
  if (!key) return 1;
  const day = Number(key.split('-')[2]);
  return Math.ceil(day / 7);
}

export function monthsFromIsoInZone(iso, timeZone = 'UTC') {
  const key = localDateKey(iso, timeZone);
  if (!key) return [];
  const [y, m] = key.split('-').map(Number);
  return [{ year: y, month: m }];
}
