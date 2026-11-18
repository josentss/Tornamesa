import { normalizeTimeZone, zonedMonthRange } from '@/lib/timezone';

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
export const MAX_TOP_MONTHS = 24;

function normalizeMonth(value) {
  let year;
  let month;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) throw new RangeError('Invalid selected month');
    year = Number(match[1]);
    month = Number(match[2]);
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    year = value.year;
    month = value.month;
  } else {
    throw new RangeError('Invalid selected month');
  }

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid selected month');
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Shared month selection for annual and customized tops.
 * No overlapping/duplicate month: an album listen is never counted twice.
 * Ranges are [start, end) in the PROFILE OWNER's timezone (not the viewer's).
 */
export function buildTopMonthRanges(months, timeZone = 'UTC') {
  if (!Array.isArray(months) || months.length < 1 || months.length > MAX_TOP_MONTHS) {
    throw new RangeError('Select between 1 and 24 months');
  }
  const normalized = months.map(normalizeMonth);
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError('Duplicate selected month');
  }
  const zone = normalizeTimeZone(timeZone);
  return normalized.sort().map((key) => {
    const [year, month] = key.split('-').map(Number);
    const range = zonedMonthRange(year, month, zone);
    if (!range.start || !range.end ||
        new Date(range.start).getTime() >= new Date(range.end).getTime()) {
      throw new RangeError('Invalid timezone month boundary');
    }
    return { month: key, start: range.start, end: range.end };
  });
}

export function buildYearTopRanges(year, timeZone = 'UTC') {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError('Invalid year');
  }
  return buildTopMonthRanges(
    Array.from({ length: 12 }, (_, index) => ({
      year,
      month: index + 1,
    })),
    timeZone
  );
}

/** Pass only server-verified period boundaries to the service-role RPC. */
export function toTopRpcRanges(ranges) {
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > MAX_TOP_MONTHS) {
    throw new RangeError('Invalid ranges');
  }
  return ranges.map(({ start, end }) => ({ start, end }));
}
