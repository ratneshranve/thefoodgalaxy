import { API_BASE_URL } from '@food/api/config';

const SOCKET_PORT =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_PORT
    ? String(import.meta.env.VITE_SOCKET_PORT).trim()
    : '5001';

const SOCKET_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_BASE_URL
    ? String(import.meta.env.VITE_SOCKET_BASE_URL).trim().replace(/\/$/, '')
    : '';

function stripApiPath(url) {
  return String(url || '')
    .replace(/\/api\/v\d+\/?$/i, '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '');
}

function toSocketOriginFromApi(apiUrl) {
  const base = stripApiPath(apiUrl);
  const fallbackBase =
    typeof window !== 'undefined' ? window.location.origin : undefined;

  const parsed = new URL(base, fallbackBase);

  // In production (HTTPS), sockets usually go through port 443 via Nginx proxy, so don't force port 5001.
  if (parsed.protocol === 'https:') {
    return parsed.origin;
  }

  if (!SOCKET_PORT) {
    return parsed.origin;
  }

  if (parsed.port === SOCKET_PORT) {
    return parsed.origin;
  }

  parsed.port = SOCKET_PORT;
  return parsed.origin;
}

/**
 * Socket.IO runs on a dedicated server in this project.
 * Example: API=http://localhost:5000/api/v1 -> Socket=http://localhost:5001
 * You can override explicitly with VITE_SOCKET_BASE_URL.
 */
export function resolveSocketOrigin() {
  if (SOCKET_BASE_URL) {
    return SOCKET_BASE_URL;
  }

  const backendUrl = API_BASE_URL || '';
  if (!String(backendUrl).trim()) {
    if (typeof window === 'undefined') return '';
    try {
      const parsed = new URL(window.location.origin);
      if (parsed.protocol !== 'https:' && SOCKET_PORT && parsed.port !== SOCKET_PORT) {
        parsed.port = SOCKET_PORT;
      }
      return parsed.origin;
    } catch {
      return window.location.origin;
    }
  }

  try {
    return toSocketOriginFromApi(backendUrl);
  } catch {
    const stripped = stripApiPath(backendUrl);
    if (!stripped.startsWith('http')) return typeof window !== 'undefined' ? window.location.origin : '';

    try {
      const parsed = new URL(stripped);
      if (parsed.protocol !== 'https:' && SOCKET_PORT && parsed.port !== SOCKET_PORT) {
        parsed.port = SOCKET_PORT;
      }
      return parsed.origin;
    } catch {
      return stripped;
    }
  }
}

export function isValidSocketOrigin(origin) {
  return Boolean(origin && String(origin).startsWith('http'));
}
