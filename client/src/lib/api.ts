/**
 * API Configuration for Hybrid Deployment
 *
 * In development: Uses Vite proxy to localhost:3001
 * In production: Uses VITE_API_URL environment variable (Render backend)
 */

// Get the API base URL from environment or default to relative path
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Create a full API URL
 * @param path - API endpoint path (e.g., '/api/agents')
 * @returns Full URL to the API endpoint
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If API_BASE_URL is set (production), use it; otherwise use relative path
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}

/**
 * Enhanced fetch wrapper that automatically uses the correct API URL
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Fetch promise
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);

  // Default headers
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important for CORS with cookies
  });
}

/**
 * Get WebSocket URL for SSE/WebSocket connections
 * @param path - WebSocket endpoint path
 * @returns WebSocket URL
 */
export function getWebSocketUrl(path: string): string {
  if (API_BASE_URL) {
    // Convert https:// to wss:// and http:// to ws://
    const wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    return `${wsBase}${path}`;
  }

  // For development, use relative path or construct from window.location
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }

  return path;
}

/**
 * Check if we're in production mode
 */
export const isProduction = import.meta.env.PROD;

/**
 * Check if we're using a remote API
 */
export const isRemoteAPI = Boolean(API_BASE_URL);

// Log API configuration in development
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    baseUrl: API_BASE_URL || 'relative (via Vite proxy)',
    isProduction,
    isRemoteAPI,
  });
}
