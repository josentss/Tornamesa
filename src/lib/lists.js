export async function getListsWithCounts(userId) {
  const supabase = createSupabaseServer();
  await ensureToListenList(userId);

  const { data: lists, error } = await supabase
    .from('lists')
    .select('id, user_id, name, description, is_system, created_at, updated_at')
    .eq('user_id', userId)
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!lists?.length) return [];

  const listIds = lists.map((l) => l.id);

  const { data: items } = await supabase
    .from('list_items')
    .select('list_id, album_id, added_at')
    .in('list_id', listIds)
    .order('added_at', { ascending: false });

  const counts = {};
  const previewIdsByList = {};

  (items || []).forEach((item) => {
    counts[item.list_id] = (counts[item.list_id] || 0) + 1;
    if (!previewIdsByList[item.list_id]) previewIdsByList[item.list_id] = [];
    if (previewIdsByList[item.list_id].length < 3) {
      previewIdsByList[item.list_id].push(item.album_id);
    }
  });

  const allPreviewIds = [
    ...new Set(Object.values(previewIdsByList).flat()),
  ];

  const coverMap = {};
  if (allPreviewIds.length > 0) {
    const { data: albums } = await supabase
      .from('albums')
      .select('spotify_id, cover_url')
      .in('spotify_id', allPreviewIds);

    (albums || []).forEach((a) => {
      coverMap[a.spotify_id] = a.cover_url;
    });
  }

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    isSystem: list.is_system,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    count: counts[list.id] || 0,
    previewCovers: (previewIdsByList[list.id] || [])
      .map((id) => coverMap[id])
      .filter(Boolean),
  }));
}
