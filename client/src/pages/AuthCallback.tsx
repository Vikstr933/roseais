import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { login } = useAuth();

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  async function handleOAuthCallback() {
    try {
      // Get the session from the URL hash
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        const user = data.session.user;
        
        // Register/login the user in our system
        const response = await fetch('/api/auth/oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: user.app_metadata.provider,
            providerId: user.id,
            email: user.email,
            displayName: user.user_metadata.full_name || user.user_metadata.name || user.email,
            avatarUrl: user.user_metadata.avatar_url || user.user_metadata.picture,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to register OAuth user');
        }

        const userData = await response.json();
        
        // Update auth context
        login(userData.user, userData.sessionToken);

        // Check for pending prompt from homepage
        const pendingPrompt = localStorage.getItem('pendingPrompt');
        if (pendingPrompt) {
          // Redirect to playground with the prompt
          setLocation(`/playground?prompt=${encodeURIComponent(pendingPrompt)}`);
        } else {
          // Redirect to home
          setLocation('/');
        }
      } else {
        throw new Error('No session found');
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

