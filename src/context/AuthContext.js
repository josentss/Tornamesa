'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

function mapAuthError(err, fallback) {
  const msg = (err?.message || '').toLowerCase();
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists')
  ) {
    return 'This email is already registered. Try logging in.';
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Invalid email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email before logging in.';
  }
  if (msg.includes('password')) {
    return 'Password does not meet requirements.';
  }
  return fallback;
}

function mergeAuthAndProfile(authUser, profile, prev) {
  if (!authUser) return null;
  const fromProfile = profile && typeof profile === 'object' ? profile : null;
  return {
    ...authUser,
    username:
      fromProfile?.username ||
      prev?.username ||
      authUser.user_metadata?.username ||
      null,
    avatar_url:
      fromProfile?.avatar_url !== undefined && fromProfile?.avatar_url !== null
        ? fromProfile.avatar_url
        : fromProfile
          ? fromProfile.avatar_url || null
          : prev?.avatar_url ?? null,
    full_name: fromProfile?.full_name ?? prev?.full_name ?? null,
    bio: fromProfile?.bio ?? prev?.bio ?? null,
    onboarding_completed:
      fromProfile?.onboarding_completed !== undefined
        ? !!fromProfile.onboarding_completed
        : prev?.onboarding_completed ?? false,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();
  const userRef = useRef(null);
  userRef.current = user;

  const enrichUser = useCallback(async (authUser) => {
    if (!authUser?.id) return authUser;
    try {
      const profile = await api.getUserProfile(authUser.id).catch(() => null);
      return mergeAuthAndProfile(authUser, profile, userRef.current);
    } catch (err) {
      console.error('Error enriching user:', err.message);
      return mergeAuthAndProfile(authUser, null, userRef.current);
    }
  }, []);

  const applyProfile = useCallback((profile) => {
    if (!profile) return;
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        username: profile.username ?? prev.username,
        avatar_url:
          profile.avatar_url !== undefined
            ? profile.avatar_url
            : prev.avatar_url,
        full_name:
          profile.full_name !== undefined
            ? profile.full_name
            : prev.full_name,
        bio: profile.bio !== undefined ? profile.bio : prev.bio,
        onboarding_completed:
          profile.onboarding_completed !== undefined
            ? !!profile.onboarding_completed
            : prev.onboarding_completed,
        user_metadata: {
          ...(prev.user_metadata || {}),
          username: profile.username ?? prev.user_metadata?.username,
        },
      };
      userRef.current = next;
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        userRef.current = null;
        return null;
      }
      const enriched = await enrichUser(session.user);
      setUser(enriched);
      userRef.current = enriched;
      return enriched;
    } catch (err) {
      console.error('refreshUser error:', err.message);
      return null;
    }
  }, [supabase, enrichUser]);

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
          if (mounted) {
            setUser(enriched);
            userRef.current = enriched;
          }
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
        userRef.current = null;
        setError(null);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setUser(null);
        userRef.current = null;
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setUser((prev) => {
          if (!prev) return prev;
          const next = {
            ...session.user,
            username: prev.username,
            avatar_url: prev.avatar_url,
            full_name: prev.full_name,
            bio: prev.bio,
            onboarding_completed: prev.onboarding_completed,
          };
          userRef.current = next;
          return next;
        });
        return;
      }

      if (event === 'USER_UPDATED') {
        setUser((prev) => {
          const next = {
            ...session.user,
            username:
              session.user.user_metadata?.username ||
              prev?.username ||
              null,
            avatar_url: prev?.avatar_url ?? null,
            full_name: prev?.full_name ?? null,
            bio: prev?.bio ?? null,
            onboarding_completed: prev?.onboarding_completed ?? false,
          };
          userRef.current = next;
          return next;
        });
        setError(null);
        setLoading(false);
        return;
      }

      const enriched = await enrichUser(session.user);
      setUser(enriched);
      userRef.current = enriched;
      setError(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase, enrichUser]);

  const signUp = async (email, password, username) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { username } },
    });
    if (signUpError) {
      const message = mapAuthError(
        signUpError,
        'Could not complete registration. Check your details.'
      );
      setError(message);
      throw new Error(message);
    }
    return { success: true, user: data.user };
  };

  const signIn = async (email, password) => {
    setError(null);
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
    if (signInError) {
      const message = mapAuthError(signInError, 'Invalid email or password.');
      setError(message);
      throw new Error(message);
    }
    const enriched = await enrichUser(data.user);
    setUser(enriched);
    userRef.current = enriched;
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
    userRef.current = null;
    return { success: true };
  };

  const resetPassword = async (email) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshUser,
        applyProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
