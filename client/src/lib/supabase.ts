import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. OAuth will not work.');
  console.warn('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * OAuth Sign In
 * @param provider - 'google', 'github', 'discord', 'apple', or 'facebook'
 */
export async function signInWithOAuth(provider: 'google' | 'github' | 'discord' | 'apple' | 'facebook') {
  // Use the full URL including protocol for redirectTo
  const redirectUrl = `${window.location.origin}/auth/callback`;
  console.log('OAuth redirect URL:', redirectUrl);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        // Add any additional query params if needed
      },
      skipBrowserRedirect: false, // Let Supabase handle the redirect
    },
    // Also set scopes if needed
    ...(provider === 'github' ? { scopes: 'read:user user:email' } : {}),
  });

  if (error) {
    console.error(`OAuth ${provider} error:`, error);
    throw error;
  }

  return data;
}

/**
 * Sign Out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get Current Session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Get session error:', error);
    return null;
  }
  return data.session;
}

/**
 * Get Current User
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Get user error:', error);
    return null;
  }
  return data.user;
}

/**
 * Listen to Auth State Changes
 */
export function onAuthStateChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session);
    callback(session);
  });
}

