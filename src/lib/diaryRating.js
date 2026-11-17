/**
 * A listen and an album review are separate records. Keep the raw listen
 * rating available for editing; only fall back to the album review when a
 * listen has no rating of its own.
 *
 * Monthly Top deliberately uses the album-review rating first, independently
 * of how an individual diary entry is displayed.
 */
export function resolveDiaryRating(listenRating, albumRating) {
  return listenRating ?? albumRating ?? null;
}

export function enrichDiaryRatings(history, reviews = []) {
  const reviewRatings = new Map(
    (reviews || [])
      .filter((review) => review.album_id && review.rating != null)
      .map((review) => [review.album_id, review.rating])
  );

  return (history || []).map((item) => {
    const albumId = item.albums?.spotify_id || item.album_id;
    const albumRating = reviewRatings.get(albumId) ?? null;
    const listenRating = item.rating ?? null;
    return {
      ...item,
      listenRating,
      albumRating,
      rating: resolveDiaryRating(listenRating, albumRating),
    };
  });
}
