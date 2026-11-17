/**
 * Canonical user/album rating comes ONLY from public.reviews.
 * Legacy listens.rating / listens.review remain stored as historical data.
 * A log never overrides its album's rating or creates a new review on read.
 */
export function resolveDiaryRating(albumRating) {
  return albumRating ?? null;
}

export function enrichDiaryRatings(history, reviews = [], { includeLegacy = false } = {}) {
  const byAlbum = new Map(
    (reviews || [])
      .filter((r) => r.album_id && r.rating != null)
      .map((r) => [r.album_id, r])
  );

  return (history || []).map((item) => {
    const id = item.albums?.spotify_id || item.album_id;
    const review = byAlbum.get(id);
    const albumRating = resolveDiaryRating(review?.rating);
    const albumReview = review?.review_text ?? null;
    const { rating: legacyRating, review: oldListenNote, ...rest } = item;

    return {
      ...rest,
      rating: albumRating,
      review: albumReview,
      albumRating,
      albumReview,
      // Only the account owner's endpoint exposes archival notes/ratings.
      ...(includeLegacy
        ? { listenRating: legacyRating ?? null, legacyNote: oldListenNote ?? null }
        : {}),
    };
  });
}
