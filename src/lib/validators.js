export const RESERVED_USERNAMES = [
  'buscar', 'login', 'register', 'album', 'api',
  'admin', 'settings', 'perfil', 'u', 'user', 'dashboard'
];

export function validateUsername(username) {
  if (!username) return false;
  const lower = username.toLowerCase();
  if (RESERVED_USERNAMES.includes(lower)) return false;
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
}

export function sanitizeString(str) {
  return str?.trim().substring(0, 500) || '';
}
