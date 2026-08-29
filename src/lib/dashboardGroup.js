export function groupOwnHistory(history) {
  const map = {};
  (history || []).forEach((item) => {
    const album = item.albums;
    if (!album?.spotify_id) return;
    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    const key = `${day}_${album.spotify_id}`;
    if (!map[key]) {
      map[key] = {
        key,
        count: 0,
        rating: item.rating,
        listened_at: item.listened_at,
        album: {
          id: album.spotify_id,
          title: album.title,
          artist: album.artist,
          cover: album.cover_url,
        },
      };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.listened_at || "").localeCompare(a.listened_at || ""))
    .slice(0, 6);
}

export function groupFriendsFeed(feed) {
  const map = {};
  (feed || []).forEach((item) => {
    if (!item.album_id) return;
    const when = item.activity_at || item.created_at || item.listened_at || "";
    const day = String(when).split("T")[0] || "Unknown";
    const key = `${day}_${item.username || "user"}_${item.album_id}`;
    if (!map[key]) {
      map[key] = {
        ...item,
        key,
        count: 0,
        activity_at: when,
        listened_at: item.listened_at || when,
      };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    const t = new Date(when).getTime();
    const prev = new Date(map[key].activity_at || 0).getTime();
    if (when && (!map[key].activity_at || t > prev)) {
      map[key].activity_at = when;
      map[key].listened_at = item.listened_at || when;
      if (item.album_cover) map[key].album_cover = item.album_cover;
      if (item.album_title) map[key].album_title = item.album_title;
    }
  });
  return Object.values(map)
    .sort((a, b) => {
      const tb = new Date(b.activity_at || b.listened_at || 0).getTime();
      const ta = new Date(a.activity_at || a.listened_at || 0).getTime();
      return tb - ta;
    })
    .slice(0, 6);
}
