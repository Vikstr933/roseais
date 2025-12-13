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
 * Enhanced fetch wrapper that automatically uses the correct API URL and includes authentication
 * With retry logic for backend wake-up scenarios (Render free tier)
 * @param path - API endpoint path
 * @param options - Fetch options
 * @param retries - Number of retries (default: 3)
 * @returns Fetch promise
 */
export async function apiFetch(
  path: string, 
  options?: RequestInit,
  retries = 3
): Promise<Response> {
  const url = getApiUrl(path);

  // Get auth token from localStorage
  const token = localStorage.getItem('sessionToken');

  // Default headers with automatic authentication
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Merge headers (user-provided headers can override defaults)
  const headers = {
    ...defaultHeaders,
    ...options?.headers,
  };

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Important for CORS with cookies
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      // If we get a response (even error), return it
      if (response.status !== 0) {
        return response;
      }
      
      throw new Error('Network request failed with status 0');
    } catch (error: any) {
      lastError = error;
      
      // If it's the last attempt, throw the error
      if (attempt === retries) {
        console.error(`[API] Request failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      
      // If it's a network error (CORS, timeout, connection refused), retry
      const isNetworkError = 
        error.name === 'TypeError' || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.name === 'AbortError';
        
      if (isNetworkError) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[API] Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Request failed');
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
