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

async function authHeadersOptional() {
  try {
    const client = createClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  } catch {
    return {};
  }
}

export const api = {
  searchAlbums: (query, type = 'album') =>
    fetchApi(
      `/api/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type || 'album')}`,
      { cache: 'no-store' }
    ),

  getAlbumDetails: (id) => fetchApi(`/api/albums/${id}`),

  registerListen: async (albumId, userId, rating, review) =>
    fetchApi('/api/listen', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        albumId,
        userId,
        rating,
        review,
        timezone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'UTC',
      }),
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

  getUserHistory: async (userId, limit = 50, offset = 0) =>
      fetchApi(
        `/api/users/${userId}/history?limit=${limit}&offset=${offset}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: await authHeaders(),
        }
    ),

    getFriendsFeed: async (userId) =>
      fetchApi(`/api/users/${userId}/feed?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: await authHeaders(),
      }),

  getOnThisDay: async (userId) =>
    fetchApi(`/api/users/${userId}/on-this-day?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: await authHeaders(),
    }),

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

  getPublicProfile: async (username, _ignored = null) => {
    const headers = await authHeadersOptional();
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}?_t=${Date.now()}`,
      { cache: 'no-store', headers }
    );
  },

  getPublicHistory: async (username, limit = 40, offset = 0, _ignored = null) => {
    const headers = await authHeadersOptional();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/history?${params}`,
      { cache: 'no-store', headers }
    );
  },

  getProfileStats: (username) =>
    fetchApi(`/api/profiles/username/${encodeURIComponent(username)}/stats?_t=${Date.now()}`, {
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

  getFollowers: async (username, _ignored = null, limit = 40, offset = 0) => {
    const headers = await authHeadersOptional();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/followers?${params}`,
      { cache: 'no-store', headers }
    );
  },

  getFollowing: async (username, _ignored = null, limit = 40, offset = 0) => {
    const headers = await authHeadersOptional();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/following?${params}`,
      { cache: 'no-store', headers }
    );
  },

  discoverUsers: async (q = '', _ignored = null, limit = 24, offset = 0) => {
    const headers = await authHeadersOptional();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (q) params.set('q', q);
    return fetchApi(`/api/discover/users?${params}`, {
      cache: 'no-store',
      headers,
    });
  },

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

  getUserReviews: (username, limit = 20, offset = 0, rating = null) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      _t: String(Date.now()),
    });
    if (rating != null && rating !== 'all' && rating !== '') {
      params.set('rating', String(rating));
    }
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/reviews?${params}`,
      { cache: 'no-store' }
    );
  },

  getFriendsReviews: async (userId) =>
    fetchApi(`/api/users/${userId}/friends-reviews?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: await authHeaders(),
    }),

  getList: async (listId) =>
      fetchApi(`/api/lists/${listId}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: await authHeadersOptional(),
      }),

    getUserLists: async (userId) =>
      fetchApi(`/api/users/${userId}/lists?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: await authHeadersOptional(),
      }),

    getUserListsForAlbum: async (userId, albumId) =>
      fetchApi(
        `/api/users/${userId}/lists?albumId=${encodeURIComponent(albumId)}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: await authHeaders(),
        }
      ),

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

  generateMonthlySummary: async (userId, year, month) =>
    fetchApi(`/api/users/${userId}/summaries/generate`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ year, month }),
    }),

  getMonthlyTop: (username, { year, month, week, limit } = {}) => {
    const params = new URLSearchParams({ _t: String(Date.now()) });
    if (year != null) params.set('year', year);
    if (month != null) params.set('month', month);
    if (week != null) params.set('week', week);
    if (limit != null) params.set('limit', limit);
    return fetchApi(
      `/api/profiles/username/${encodeURIComponent(username)}/monthly-top?${params}`,
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

    exportListens: async (userId, format = 'json', mode = 'detailed') => {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/users/${userId}/export?format=${encodeURIComponent(format)}&mode=${encodeURIComponent(mode)}&_t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      if (res.status === 429) {
        const retry = res.headers.get('Retry-After');
        throw new Error(
          retry
            ? `Too many exports. Try again in ${retry}s.`
            : 'Too many exports. Try again later.'
        );
      }
      if (!res.ok) {
        let msg = 'Export failed';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const suffix = mode === 'summary' ? '-summary' : '';
      if (format === 'csv') {
        return {
          type: 'csv',
          blob: await res.blob(),
          filename: `tornamesa-listens${suffix}.csv`,
        };
      }
      const json = await res.json();
      return {
        type: 'json',
        blob: new Blob([JSON.stringify(json, null, 2)], {
          type: 'application/json',
        }),
        filename: `tornamesa-listens${suffix}.json`,
        meta: json,
      };
    },

  checkHealth: () =>
    fetchApi('/api/health').catch(() => ({ status: 'offline' })),
};

export default api;
