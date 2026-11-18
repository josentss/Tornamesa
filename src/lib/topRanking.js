export const TOP_SORTS = Object.freeze(['listens', 'rating', 'repeats']);

/** Repeats excludes single-play albums: it is not a duplicate "listens" view. */
export function eligibleForTopSort(row, sort = 'listens') {
  if (!TOP_SORTS.includes(sort)) throw new RangeError('Invalid top sort');
  return sort !== 'repeats' || Number(row?.listenCount) > 1;
}

function numberOrNull(value) {
  return value == null || value === '' ? null : Number(value);
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function compareNumbersDescending(a, b) {
  return numeric(b) - numeric(a);
}

function compareNullableRatingsDescending(a, b) {
  const left = numberOrNull(a);
  const right = numberOrNull(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

/**
 * Deterministic reference order for the PostgreSQL top_albums() query.
 * Used in tests and future API contracts, not as a client-side fallback for
 * the potentially unbounded listen dataset.
 */
export function compareTopAlbums(a, b, sort = 'listens') {
  if (!TOP_SORTS.includes(sort)) throw new RangeError('Invalid top sort');
  let primary = 0;
  if (sort === 'rating') {
    primary = compareNullableRatingsDescending(a.rating, b.rating);
  } else if (sort === 'repeats') {
    primary = compareNumbersDescending(
      Math.max(0, numeric(a.listenCount) - 1),
      Math.max(0, numeric(b.listenCount) - 1)
    );
  } else {
    primary = compareNumbersDescending(a.listenCount, b.listenCount);
  }
  if (primary !== 0) return primary;
  const listenTiebreaker = compareNumbersDescending(a.listenCount, b.listenCount);
  if (listenTiebreaker !== 0) return listenTiebreaker;
  const timeComparison = new Date(a.firstListenedAt).getTime() -
    new Date(b.firstListenedAt).getTime();
  if (timeComparison !== 0) return timeComparison;
  // IDs are ASCII Spotify identifiers. Match PostgreSQL COLLATE "C".
  const left = String(a.albumId);
  const right = String(b.albumId);
  return left < right ? -1 : left > right ? 1 : 0;
}
