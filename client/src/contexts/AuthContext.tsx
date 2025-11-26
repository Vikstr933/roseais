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
  role?: string; // 'superadmin', 'admin', 'user'
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
            // HTTP error (401, 403, etc.) - invalid token
            if (res.status === 401 || res.status === 403) {
              localStorage.removeItem('sessionToken');
              setSessionToken(null);
            }
            return res.json();
          }
          return res.json();
        })
        .then(data => {
          if (data?.user) {
            setUser(data.user);
          } else if (data?.error) {
            // Server returned an error - invalid token
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
          }
        })
        .catch((error) => {
          // Network/CORS errors - don't remove token, just keep it
          // Only remove token if it's a clear auth error
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // CORS or network error - keep token, user might just be offline
            console.warn('Network error verifying session, keeping token:', error.message);
          } else {
            // Other errors - might be auth related, remove token
            console.error('Error verifying session:', error);
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
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
