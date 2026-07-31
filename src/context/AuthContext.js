'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔄 Enriquecer el user de Auth con datos de la tabla profiles
  const enrichUser = async (authUser) => {
    if (!authUser?.id) return authUser;

    try {
      const profile = await api.getUserProfile(authUser.id).catch(() => null);

      if (profile) {
        return {
          ...authUser,
          username:
            profile.username ||
            authUser.user_metadata?.username ||
            null,
          avatar_url: profile.avatar_url || null,
        };
      }

      // Si no hay perfil, al menos usar metadata
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

  // 🔐 Restaurar sesión al montar
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user) {
          const enriched = await enrichUser(session.user);
          setUser(enriched);
        }
      } catch (err) {
        console.error('Auth initialization error:', err.message);
        setError('Error al verificar la sesión.');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 👂 Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setError(null);
      } else if (session?.user) {
        const enriched = await enrichUser(session.user);
        setUser(enriched);
        setError(null);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 📝 SIGN UP
  const signUp = async (email, password, username) => {
    try {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            username: username,
          },
        },
      });

      if (signUpError) throw signUpError;

      return { success: true, user: data.user };
    } catch (err) {
      const message =
        'No se pudo completar el registro. Verifica los datos ingresados.';
      setError(message);
      throw new Error(message);
    }
  };

  // 🔑 SIGN IN
  const signIn = async (email, password, rememberMe) => {
    try {
      setError(null);
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError) throw signInError;

      const enriched = await enrichUser(data.user);
      setUser(enriched);
      return { success: true, user: enriched };
    } catch (err) {
      const message =
        'Credenciales inválidas. Por favor, verifica tu correo y contraseña.';
      setError(message);
      throw new Error(message);
    }
  };

  // 🚪 SIGN OUT
  const signOut = async () => {
    try {
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) throw signOutError;

      setUser(null);
      return { success: true };
    } catch (err) {
      const message = 'Error al cerrar sesión de forma segura.';
      setError(message);
      throw new Error(message);
    }
  };

  // 🔄 RESET PASSWORD
  const resetPassword = async (email) => {
    try {
      setError(null);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) throw resetError;

      return { success: true };
    } catch (err) {
      const message =
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';
      setError(message);
      throw new Error(message);
    }
  };

  // 🔐 UPDATE PASSWORD
  const updatePassword = async (newPassword) => {
    try {
      setError(null);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      return { success: true };
    } catch (err) {
      const message =
        'No se pudo actualizar la contraseña. Asegúrate de cumplir con los requisitos de seguridad.';
      setError(message);
      throw new Error(message);
    }
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
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
