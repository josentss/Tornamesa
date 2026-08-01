import { supabase } from '@/lib/supabase';

// funciones auxiliares
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Error ${response.status}`);
  }
  return response.json();
};

const fetchApi = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
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
  searchAlbums: (query, type = 'album') =>
    fetchApi(`/api/search?q=${encodeURIComponent(query)}&type=${type}`),

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
    fetchApi(`/api/users/${userId}?_t=${Date.now()}`, { cache: 'no-store' }),

  updateUserProfile: (userId, profileData) =>
    fetchApi(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  // public profiles
  getPublicProfile: (username, currentUserId = null) => {
    const url = currentUserId
      ? `/api/profiles/username/${username}?currentUserId=${currentUserId}`
      : `/api/profiles/username/${username}`;
    return fetchApi(url);
  },

  getPublicHistory: (username, limit = 20) =>
    fetchApi(`/api/profiles/${username}/history?limit=${limit}`),

  // funciones sociales
  followUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),

  unfollowUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow/${targetId}`, { method: 'DELETE' }),

  getFriendsFeed: (userId) =>
    fetchApi(`/api/users/${userId}/feed`),

  // sacar reseñas de un álbum
  getAlbumReviews: (albumId) =>
    fetchApi(`/api/albums/${albumId}/reviews?_t=${Date.now()}`, { cache: 'no-store' }),

  // crear o actualizar reseña (con sesión)
  createReview: async (albumId, rating, reviewText) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Debes iniciar sesión');

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

  // resumenes
  generateMonthlySummary: (userId, year, month) =>
    fetchApi(`/api/users/${userId}/summaries/generate`, {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),

  // health endp
  checkHealth: () =>
    fetchApi('/api/health').catch(() => ({ status: 'offline' })),
};

export default api;
