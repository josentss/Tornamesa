'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  const enrichUser = async (authUser) => {
    if (!authUser?.id) return authUser;

    try {
      const profile = await api.getUserProfile(authUser.id).catch(() => null);

      if (profile) {
        return {
          ...authUser,
          username: profile.username || authUser.user_metadata?.username || null,
          avatar_url: profile.avatar_url || null,
        };
      }

      if (authUser.user_metadata?.username) {
        return {
          ...authUser,
          username: authUser.user_metadata.username,
          avatar_url: null,
        };
      }
    } catch (err) {
      console.error('Error enriching user:', err.message);
    }

    return authUser;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user && mounted) {
          const enriched = await enrichUser(session.user);
          if (mounted) setUser(enriched);
        }
      } catch (err) {
        console.error('Auth initialization error:', err.message);
        if (mounted) setError('Could not verify session.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const enriched = await enrichUser(session.user);
        setUser(enriched);
        setError(null);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email, password, username) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { username },
      },
    });

    if (signUpError) {
      const message =
        'Could not complete registration. Check the data you entered.';
      setError(message);
      throw new Error(message);
    }

    return { success: true, user: data.user };
  };

  const signIn = async (email, password /*, rememberMe */) => {
    setError(null);
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (signInError) {
      const message =
        'Invalid credentials. Please check your email and password.';
      setError(message);
      throw new Error(message);
    }

    const enriched = await enrichUser(data.user);
    setUser(enriched);
    return { success: true, user: enriched };
  };

  const signOut = async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      const message = 'Could not sign out securely.';
      setError(message);
      throw new Error(message);
    }

    setUser(null);
    return { success: true };
  };

  const resetPassword = async (email) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (resetError) {
      const message =
        'If the email is registered, you will receive a reset link.';
      setError(message);
      throw new Error(message);
    }

    return { success: true };
  };

  const updatePassword = async (newPassword) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      const message =
        'Could not update password. Check the security requirements.';
      setError(message);
      throw new Error(message);
    }

    return { success: true };
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
