/**
 * API Configuration for Hybrid Deployment
 *
 * In development: Uses Vite proxy to localhost:3001
 * In production: Uses VITE_API_URL environment variable (Render backend)
 */

// Get the API base URL from environment or default to relative path
// In development, this should be empty to use Vite proxy
// In production, this should be set to the Render backend URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Create a full API URL
 * @param path - API endpoint path (e.g., '/api/agents')
 * @returns Full URL to the API endpoint
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // In development (when VITE_API_URL is empty), use relative path to trigger Vite proxy
  // In production (when VITE_API_URL is set), use the full URL
  // IMPORTANT: For local development, VITE_API_URL should be empty or unset
  // All endpoints (including OAuth) go through Vite proxy in development
  // Backend handles OAuth redirect URIs correctly based on environment variables
  if (!API_BASE_URL) {
    // Development mode - use relative path (Vite proxy will handle it)
    // Vite proxy forwards to localhost:3001 (or whatever port backend runs on)
    return cleanPath;
  }
  
  // Production mode - use full URL
  return `${API_BASE_URL}${cleanPath}`;
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

  // Determine timeout based on endpoint
  // Transcription endpoints need longer timeout (3 minutes)
  // Other endpoints use default 30 seconds
  const isTranscriptionEndpoint = path.includes('/transcribe') || path.includes('/extract-audio');
  const timeoutMs = isTranscriptionEndpoint ? 180000 : 30000; // 3 minutes for transcription, 30s for others

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    let controller: AbortController | null = null;
    
    try {
      // Create AbortController for timeout
      controller = new AbortController();
      const externalSignal = options?.signal;
      
      // If there's an external signal, merge it with our timeout signal
      if (externalSignal) {
        // If external signal is already aborted, don't make the request
        if (externalSignal.aborted) {
          throw new DOMException('Request was aborted by external signal', 'AbortError');
        }
        
        // Listen to external signal and abort our controller if it aborts
        externalSignal.addEventListener('abort', () => {
          controller?.abort();
        });
      }
      
      // Set timeout based on endpoint type
      timeoutId = setTimeout(() => {
        controller?.abort();
      }, timeoutMs);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Important for CORS with cookies
        signal: controller.signal,
      });

      // Clear timeout on success
      if (timeoutId) {
      clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // If we get a response (even error), return it
      if (response.status !== 0) {
        return response;
      }
      
      throw new Error('Network request failed with status 0');
    } catch (error: any) {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      lastError = error;
      
      // If it's an AbortError from external signal (not our timeout), don't retry
      if (error.name === 'AbortError' && options?.signal?.aborted) {
        console.warn('[API] Request aborted by external signal (component unmounted or user cancelled)');
        throw error;
      }
      
      // If it's an AbortError from our timeout, provide better error message
      if (error.name === 'AbortError' && !options?.signal?.aborted) {
        // This is likely our timeout - log it but still retry
        const timeoutSeconds = timeoutMs / 1000;
        console.warn(`[API] Request timed out after ${timeoutSeconds} seconds, will retry...`);
      }
      
      // If it's the last attempt, throw the error
      if (attempt === retries) {
        console.error(`[API] Request failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      
      // If it's a network error (CORS, timeout, connection refused), retry
      const isNetworkError = 
        error.name === 'TypeError' || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        (error.name === 'AbortError' && !options?.signal?.aborted); // Only retry if it's our timeout, not external abort
        
      if (isNetworkError) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[API] Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`, error.message || error.name);
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
