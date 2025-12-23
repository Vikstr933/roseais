/**
 * Get backend URL from environment variables
 * Handles Render, Vercel, and local development
 */
export function getBackendUrl(): string {
  // Priority order:
  // 1. Explicit BACKEND_URL (most reliable)
  // 2. RENDER_EXTERNAL_URL (automatically set by Render)
  // 3. VERCEL_URL (for Vercel deployments)
  // 4. Fallback to known Render URL or localhost
  
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback for development
  const port = process.env.PORT || 3001;
  return `http://localhost:${port}`;
}

