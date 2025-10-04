import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

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
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          } else {
            // Invalid token, remove it
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
          }
        })
        .catch(() => {
          // Error verifying token, remove it
          localStorage.removeItem('sessionToken');
          setSessionToken(null);
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
      const response = await fetch('/api/auth/login', {
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

  const register = async (
    username: string,
    email: string,
    displayName: string,
    password: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/register', {
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
        await fetch('/api/auth/logout', {
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
