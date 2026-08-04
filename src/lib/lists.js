import { createSupabaseServer } from '@/lib/supabase-server';

export async function ensureToListenList(userId) {
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase
    .from('lists')
    .select('id, user_id, name, description, is_system, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_system', true)
    .eq('name', 'To Listen')
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      name: 'To Listen',
      description: 'Albums you want to listen to',
      is_system: true,
    })
    .select('id, user_id, name, description, is_system, created_at, updated_at')
    .single();

  if (error) throw error;
  return created;
}

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

  const listIds = (lists || []).map((l) => l.id);
  if (listIds.length === 0) return [];

  const { data: items } = await supabase
    .from('list_items')
    .select('list_id')
    .in('list_id', listIds);

  const counts = {};
  (items || []).forEach((item) => {
    counts[item.list_id] = (counts[item.list_id] || 0) + 1;
  });

  return (lists || []).map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    isSystem: list.is_system,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    count: counts[list.id] || 0,
  }));
}
