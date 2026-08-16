import { createClient } from '@/lib/supabase/client';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Error ${response.status}`);
  }
  return response.json();
};

const fetchApi = async (endpoint, options = {}) => {
  const { headers: optHeaders, ...rest } = options;
  try {
    const response = await fetch(endpoint, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(optHeaders || {}),
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
};

async function authHeaders() {
  const client = createClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('You must be logged in');
  return { Authorization: `Bearer ${session.access_token}` };
}

export const api = {
  searchAlbums: (query, type = 'album') =>
    fetchApi(
      `/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type || 'album')}`
    ),

  getAlbumDetails: (id) => fetchApi(`/api/albums/${id}`),

  registerListen: async (albumId, userId, rating, review) =>
    fetchApi('/api/listen', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ albumId, userId, rating, review }),
    }),

  updateListen: async (listenId, { listened_at, rating, review }) =>
    fetchApi(`/api/listen/${listenId}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ listened_at, rating, review }),
    }),

  deleteListen: async (listenId) =>
    fetchApi(`/api/listen/${listenId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    }),

  getUserHistory: (userId, limit = 50, offset = 0) =>
    fetchApi(`/api/users/${userId}/history?limit=${limit}&offset=${offset}`),

  getUserProfile: (userId) =>
    fetchApi(`/api/users/${userId}?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  updateUserProfile: async (userId, profileData) =>
    fetchApi(`/api/users/${userId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(profileData),
    }),

  updatePrivacy: async (userId, { is_private, diary_public, show_activity }) =>
    fetchApi(`/api/users/${userId}/privacy`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ is_private, diary_public, show_activity }),
    }),

  getPublicProfile: (username, currentUserId = null) => {
    const params = new URLSearchParams({ _t: String(Date.now()) });
    if (currentUserId) params.set('currentUserId', currentUserId);
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}?${params}`,
      { cache: 'no-store' }
    );
  },

  getPublicHistory: (username, limit = 40, offset = 0, currentUserId = null) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (currentUserId) params.set('currentUserId', currentUserId);
    return fetchApi(`/api/profiles/username/${username}/history?${params}`, {
      cache: 'no-store',
    });
  },

  getProfileStats: (username) =>
    fetchApi(`/api/profiles/username/${username}/stats?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  followUser: async (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ targetId }),
    }),

  unfollowUser: async (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow/${targetId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    }),

  getFollowers: (username, currentUserId = null, limit = 40, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (currentUserId) params.set('currentUserId', currentUserId);
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/followers?${params}`,
      { cache: 'no-store' }
    );
  },

  getFollowing: (username, currentUserId = null, limit = 40, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (currentUserId) params.set('currentUserId', currentUserId);
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/following?${params}`,
      { cache: 'no-store' }
    );
  },

  discoverUsers: (q = '', currentUserId = null, limit = 24, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (q) params.set('q', q);
    if (currentUserId) params.set('currentUserId', currentUserId);
    return fetchApi(`/api/discover/users?${params}`, { cache: 'no-store' });
  },

  getFriendsFeed: (userId) => fetchApi(`/api/users/${userId}/feed`),

  getAlbumReviews: (albumId) =>
    fetchApi(`/api/albums/${albumId}/reviews?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  createReview: async (albumId, rating, reviewText) =>
    fetchApi(`/api/albums/${albumId}/review`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ rating, review_text: reviewText }),
    }),

  getUserReviews: (username) =>
    fetchApi(`/api/profiles/username/${username}/reviews?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  getFriendsReviews: (userId) =>
    fetchApi(`/api/users/${userId}/friends-reviews?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  getList: (listId) =>
    fetchApi(`/api/lists/${listId}?_t=${Date.now()}`, { cache: 'no-store' }),

  addToList: async (listId, albumId, userId) =>
    fetchApi(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ albumId, userId }),
    }),

  removeFromList: async (listId, albumId) =>
    fetchApi(`/api/lists/${listId}/items/${albumId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    }),

  getUserLists: (userId) =>
    fetchApi(`/api/users/${userId}/lists?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  createList: async (userId, name, description = null) =>
    fetchApi(`/api/users/${userId}/lists`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ name, description }),
    }),

  updateList: async (listId, userId, { name, description } = {}) =>
    fetchApi(`/api/lists/${listId}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ name, description }),
    }),

  deleteList: async (listId) =>
    fetchApi(`/api/lists/${listId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    }),

  getUserListsForAlbum: (userId, albumId) =>
    fetchApi(
      `/api/users/${userId}/lists?albumId=${encodeURIComponent(albumId)}&_t=${Date.now()}`,
      { cache: 'no-store' }
    ),

  generateMonthlySummary: (userId, year, month) =>
    fetchApi(`/api/users/${userId}/summaries/generate`, {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),

  getMonthlyTop: (username, { year, month, week, limit } = {}) => {
    const params = new URLSearchParams({ _t: String(Date.now()) });
    if (year != null) params.set('year', year);
    if (month != null) params.set('month', month);
    if (week != null) params.set('week', week);
    if (limit != null) params.set('limit', limit);
    return fetchApi(
      `/api/profiles/username/${username}/monthly-top?${params}`,
      { cache: 'no-store' }
    );
  },

  previewNotesImport: async (files, { offset = 0, limit = 10 } = {}) =>
    fetchApi('/api/import/notes/preview', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ files, offset, limit }),
    }),

  commitNotesImport: async (items) =>
    fetchApi('/api/import/notes/commit', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ items }),
    }),

  checkHealth: () =>
    fetchApi('/api/health').catch(() => ({ status: 'offline' })),
};

export default api;
