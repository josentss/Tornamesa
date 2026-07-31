// src/lib/api.js

// 🔧 FUNCIONES AUXILIARES
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Error ${response.status}`);
  }
  return response.json();
};

const fetchApi = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {          // ← sin API_URL
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

// ==================== API METHODS ====================

export const api = {
  // 🔍 BÚSQUEDA Y DETALLES
  searchAlbums: (query, type = 'album') =>
    fetchApi(`/api/search?q=${encodeURIComponent(query)}&type=${type}`),

  getAlbumDetails: (id) =>
    fetchApi(`/api/albums/${id}`),

  // 🎵 ESCUCHAS
  registerListen: (albumId, userId, rating, review) =>
    fetchApi('/api/listen', {
      method: 'POST',
      body: JSON.stringify({ albumId, userId, rating, review }),
    }),

  getUserHistory: (userId, limit = 50, offset = 0) =>
    fetchApi(`/api/users/${userId}/history?limit=${limit}&offset=${offset}`),

  // 👤 PERFIL
  getUserProfile: (userId) =>
    fetchApi(`/api/users/${userId}?_t=${Date.now()}`, { cache: 'no-store' }),

  updateUserProfile: (userId, profileData) =>
    fetchApi(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  // 👤 PERFILES PÚBLICOS
  getPublicProfile: (username, currentUserId = null) => {
    const url = currentUserId
      ? `/api/profiles/username/${username}?currentUserId=${currentUserId}`
      : `/api/profiles/username/${username}`;
    return fetchApi(url);
  },

  getPublicHistory: (username, limit = 20) =>
    fetchApi(`/api/profiles/${username}/history?limit=${limit}`),

  // 👥 SISTEMA SOCIAL
  followUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),

  unfollowUser: (userId, targetId) =>
    fetchApi(`/api/users/${userId}/follow/${targetId}`, { method: 'DELETE' }),

  getFriendsFeed: (userId) =>
    fetchApi(`/api/users/${userId}/feed`),

  // 📊 RESÚMENES
  generateMonthlySummary: (userId, year, month) =>
    fetchApi(`/api/users/${userId}/summaries/generate`, {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    }),

  // ❤️ HEALTH
  checkHealth: () =>
    fetchApi('/api/health').catch(() => ({ status: 'offline' })),
};

export default api;
