import { createClient } from '@/lib/supabase/client';

// funciones auxiliares
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

// api endpoints

export const api = {
  // buscar y obtener detalles
  searchAlbums: (query) =>
    fetchApi(`/api/search?q=${encodeURIComponent(query)}`),

  getAlbumDetails: (id) =>
    fetchApi(`/api/albums/${id}`),

  // escuchas (registro y manejo)
  registerListen: (albumId, userId, rating, review) =>
    fetchApi('/api/listen', {
      method: 'POST',
      body: JSON.stringify({ albumId, userId, rating, review }),
    }),

  getUserHistory: (userId, limit = 50, offset = 0) =>
    fetchApi(`/api/users/${userId}/history?limit=${limit}&offset=${offset}`),

  // profile
  getUserProfile: (userId) =>
      fetchApi(`/api/users/${userId}?_t=${Date.now()}`, {
        cache: 'no-store',
      }),

  updateUserProfile: async (userId, profileData) => {
    let session = null;
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();
      const res = await client.auth.getSession();
      session = res.data.session;
    } catch {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }

    if (!session?.access_token) {
      throw new Error('You must be logged in');
    }

    return fetchApi(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(profileData),
    });
  },

  updatePrivacy: async (userId, { is_private, diary_public, show_activity }) => {
    const { createClient } = await import('@/lib/supabase/client');
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.access_token) {
      throw new Error('You must be logged in');
    }
    return fetchApi(`/api/users/${userId}/privacy`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ is_private, diary_public, show_activity }),
    });
  },

  // public profiles
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
    return fetchApi(
      `/api/profiles/username/${username}/history?${params}`,
      { cache: 'no-store' }
    );
  },

  getProfileStats: (username) =>
    fetchApi(
      `/api/profiles/username/${username}/stats?_t=${Date.now()}`,
      { cache: 'no-store' }
    ),

  // funciones sociales
  followUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),

  unfollowUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow/${targetId}`, { method: 'DELETE' }),

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

  getFriendsFeed: (userId) =>
    fetchApi(`/api/users/${userId}/feed`),

  // sacar reseñas de un álbum
  getAlbumReviews: (albumId) =>
    fetchApi(`/api/albums/${albumId}/reviews?_t=${Date.now()}`, { cache: 'no-store' }),

  // crear o actualizar reseña (con sesión)
  createReview: async (albumId, rating, reviewText) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in');

      const res = await fetchApi(`/api/albums/${albumId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rating, review_text: reviewText }),
      });

      return res;
  },

  // obtener reseñas de un usuario
  getUserReviews: (username) =>
    fetchApi(`/api/profiles/username/${username}/reviews?_t=${Date.now()}`, { cache: 'no-store' }),

  getFriendsReviews: (userId) =>
    fetchApi(`/api/users/${userId}/friends-reviews?_t=${Date.now()}`, {
      cache: 'no-store',
    }),

  // listas
  getList: (listId) =>
    fetchApi(`/api/lists/${listId}?_t=${Date.now()}`, { cache: 'no-store' }),

  addToList: (listId, albumId, userId) =>
    fetchApi(`/api/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify({ albumId, userId }),
    }),

  removeFromList: (listId, albumId, userId) =>
    fetchApi(`/api/lists/${listId}/items/${albumId}?userId=${userId}`, {
      method: 'DELETE',
    }),

  getUserLists: (userId) =>
    fetchApi(`/api/users/${userId}/lists?_t=${Date.now()}`, { cache: 'no-store' }),

  createList: (userId, name, description = null) =>
    fetchApi(`/api/users/${userId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  updateList: (listId, userId, { name, description } = {}) =>
    fetchApi(`/api/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, name, description }),
    }),

  deleteList: (listId, userId) =>
    fetchApi(`/api/lists/${listId}?userId=${userId}`, {
      method: 'DELETE',
    }),

  getUserListsForAlbum: (userId, albumId) =>
    fetchApi(
      `/api/users/${userId}/lists?albumId=${encodeURIComponent(albumId)}&_t=${Date.now()}`,
      { cache: 'no-store' }
    ),

  // resumenes
  generateMonthlySummary: (userId, year, month) =>
    fetchApi(`/api/users/${userId}/summaries/generate`, {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),

  // obtener el top de discos x mes
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

  // health endp
  checkHealth: () =>
    fetchApi('/api/health').catch(() => ({ status: 'offline' })),
};

export default api;
