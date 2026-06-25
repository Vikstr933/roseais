import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { apiFetch } from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: string; // 'superadmin', 'admin', 'user'
  tier?: 'free' | 'pro' | 'enterprise';
  subscriptionStatus?: string;
  createdAt: string;
  lastActive: string;
  preferences: any;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithOAuth: (user: User, token: string) => void;
  register: (
    username: string,
    email: string,
    displayName: string,
    password: string
  ) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    
    // Safety timeout - always set loading to false after 5 seconds
    const loadingTimeout = setTimeout(() => {
      console.warn('⚠️ Auth loading timeout - forcing isLoading to false');
      setIsLoading(false);
    }, 5000);
    
    if (token) {
      setSessionToken(token);
      // Verify token with server
      apiFetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(res => {
          if (!res.ok) {
            // Only remove token on clear authentication errors (401, 403)
            // For other errors (500, 503, etc.), keep token - might be server issue
            if (res.status === 401 || res.status === 403) {
              console.warn('Authentication failed, removing token');
              localStorage.removeItem('sessionToken');
              setSessionToken(null);
              setIsLoading(false);
              return null;
            }
            // For other HTTP errors, try to parse response but keep token
            return res.json().catch(() => null);
          }
          return res.json();
        })
        .then(data => {
          if (!data) {
            // No data returned - might be server issue, but don't block app
            // Keep token and user state - might be offline or temporary server issue
            console.warn('No data from /api/auth/me - keeping token, might be offline or server issue');
            // Don't remove user or token - keep existing state if available
            setIsLoading(false);
            return;
          }
          if (data?.user) {
            setUser(data.user);
            setIsLoading(false);
          } else if (data?.error && (data.error.includes('unauthorized') || data.error.includes('forbidden') || data.error.includes('invalid'))) {
            // Only remove token for clear auth errors
            console.warn('Auth error in response, removing token:', data.error);
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
            setUser(null);
            setIsLoading(false);
          } else {
            // If no user but no clear error, keep token (might be server issue)
            // But still set loading to false to not block the app
            // Don't remove user - keep existing state
            console.warn('No user in response but no clear error - keeping token and user state');
            setIsLoading(false);
          }
        })
        .catch((error) => {
          // Network/CORS errors - keep token AND user state, user might just be offline or server down
          console.warn('Network error verifying session, keeping token and user state:', error.message);
          // Don't remove token or user on network errors - user might be offline
          // Keep existing user state if available
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
    
    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSessionToken(data.sessionToken);
        localStorage.setItem('sessionToken', data.sessionToken);
        
        // Clear API cache in service worker after login
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginWithOAuth = (user: User, token: string) => {
    setUser(user);
    setSessionToken(token);
    localStorage.setItem('sessionToken', token);
    
    // Clear API cache in service worker after login
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
    }
  };

  const register = async (
    username: string,
    email: string,
    displayName: string,
    password: string
  ): Promise<boolean> => {
    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, displayName, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSessionToken(data.sessionToken);
        localStorage.setItem('sessionToken', data.sessionToken);
        
        // Clear API cache in service worker after registration
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSessionToken(null);
      localStorage.removeItem('sessionToken');
    }
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const value: AuthContextType = {
    user,
    sessionToken,
    isSuperAdmin,
    isAdmin,
    login,
    loginWithOAuth,
    register,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to get auth headers
export function getAuthHeaders(sessionToken: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  return headers;
}
