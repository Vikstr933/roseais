import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, getApiUrl } from '../lib/api';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { loginWithOAuth } = useAuth();

  useEffect(() => {
    // Small delay to ensure component is mounted and Supabase is ready
    const timer = setTimeout(() => {
      handleOAuthCallback();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  async function handleOAuthCallback() {
    try {
      console.log('Starting OAuth callback...');
      console.log('Current URL:', window.location.href);
      console.log('URL hash:', window.location.hash);

      // Check if we have access_token in hash directly
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('Found access_token in hash, parsing manually...');
        
        // Parse hash fragment manually if Supabase hasn't processed it yet
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const expiresAt = hashParams.get('expires_at');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken) {
          console.log('Found access_token in hash, setting session manually...');
          
          // Try to set the session manually
          try {
            const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (setSessionError) {
              console.error('Error setting session:', setSessionError);
            } else if (setSessionData.session) {
              console.log('Session set successfully, continuing...');
              // Continue with the callback using the session we just set
            }
          } catch (setSessionErr) {
            console.warn('Could not set session manually, will try getSession:', setSessionErr);
          }
        }
      }

      // Wait a bit for Supabase to process the hash fragment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the session from the URL hash
      // Supabase automatically processes hash fragments with detectSessionInUrl: true
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Supabase session error:', error);
        throw error;
      }

      if (data.session) {
        const user = data.session.user;
        console.log('Got Supabase session for user:', user.email);

        // Register/login the user in our system
        const apiUrl = getApiUrl('/api/auth/oauth');
        console.log('Calling backend OAuth endpoint...', {
          url: apiUrl,
          apiBaseUrl: import.meta.env.VITE_API_URL || 'not set (using relative path)',
          isProduction: import.meta.env.PROD,
        });
        const response = await apiFetch('/api/auth/oauth', {
          method: 'POST',
          body: JSON.stringify({
            provider: user.app_metadata.provider,
            providerId: user.id,
            email: user.email,
            displayName: user.user_metadata.full_name || user.user_metadata.name || user.email,
            avatarUrl: user.user_metadata.avatar_url || user.user_metadata.picture,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Backend OAuth error:', response.status, errorText);
          throw new Error(`Failed to register OAuth user: ${response.status} ${errorText}`);
        }

        const userData = await response.json();
        console.log('Backend OAuth success:', userData);

        // Update auth context
        loginWithOAuth(userData.user, userData.sessionToken);

        // Clear the hash fragment from URL immediately to prevent issues
        if (window.location.hash) {
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }

        // Check for pending prompt from homepage
        const pendingPrompt = localStorage.getItem('pendingPrompt');
        if (pendingPrompt) {
          localStorage.removeItem('pendingPrompt');
          // Redirect to playground with the prompt
          setLocation(`/playground?prompt=${encodeURIComponent(pendingPrompt)}`);
        } else {
          // Redirect to home
          setLocation('/');
        }
      } else {
        // If no session, try to get it from the URL hash manually
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('Found access_token in hash, trying to parse and set session...');
          
          // Parse hash fragment
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken) {
            try {
              // Set session manually
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (sessionError) {
                console.error('Error setting session from hash:', sessionError);
                setError('Failed to authenticate. Please try logging in again.');
                setTimeout(() => setLocation('/'), 3000);
                return;
              }
              
              if (sessionData.session) {
                console.log('Session set from hash, retrying callback...');
                // Retry the callback with the new session
                setTimeout(() => handleOAuthCallback(), 500);
                return;
              }
            } catch (parseError) {
              console.error('Error parsing hash:', parseError);
            }
          }
          
          // If we still don't have a session, wait and retry
          console.log('Waiting for Supabase to process hash...');
          setTimeout(async () => {
            const { data: retryData, error: retryError } = await supabase.auth.getSession();
            if (retryError) {
              console.error('Retry session error:', retryError);
              setError('Failed to authenticate. Please try logging in again.');
              setTimeout(() => setLocation('/'), 3000);
            } else if (retryData.session) {
              // Retry the callback
              handleOAuthCallback();
            } else {
              setError('No session found. Please try logging in again.');
              setTimeout(() => setLocation('/'), 3000);
            }
          }, 2000);
          return;
        }
        
        // No hash found - this might be a direct navigation to /auth/callback
        console.warn('No session and no hash found - might be direct navigation');
        setError('No authentication data found. Please try logging in again.');
        setTimeout(() => setLocation('/'), 3000);
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Authentication failed');
      setTimeout(() => setLocation('/'), 3000);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-green-500 text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

