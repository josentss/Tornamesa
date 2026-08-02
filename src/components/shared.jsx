'use client';

import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function Header({ user: initialUser }) {
  const { user: authUser, signOut } = useAuth();
  const router = useRouter();
  const user = initialUser || authUser;
  const [showMenu, setShowMenu] = useState(false);
  const [username, setUsername] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setUsername(null);
      setAvatarUrl(null);
      return;
    }

    // 1. Datos ya enriquecidos desde AuthContext
    if (user.username) setUsername(user.username);
    if (user.avatar_url) setAvatarUrl(user.avatar_url);

    if (user.username && user.avatar_url) return;

    // 2. Fallback a metadata
    if (!user.username && user.user_metadata?.username) {
      setUsername(user.user_metadata.username);
    }

    // 3. Consultar perfil si falta username o avatar
    if (!user.username || !user.avatar_url) {
      let cancelled = false;

      api
        .getUserProfile(user.id)
        .then((data) => {
          if (cancelled) return;
          if (data?.username) setUsername(data.username);
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Error loading header profile:', err);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowMenu(false);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const displayInitial = username
    ? username.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  const profileUrl = username ? `/${username}` : '/settings/profile';

  return (
    <header className="w-full bg-[#0a0f16] border-b border-[#1e293b] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 md:px-6 py-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tighter text-[#f0f9ff]"
        >
          Tornamesa
        </Link>

        <div className="flex items-center gap-4 md:gap-6">
          <Link
            href="/search"
            className="text-stone-400 hover:text-[#87ceeb] transition-colors"
            title="Search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full bg-[#131b26] border border-[#1e293b] flex items-center justify-center hover:border-[#87ceeb] transition-colors overflow-hidden"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={username || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-[#87ceeb]">
                    {displayInitial}
                  </span>
                )}
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#131b26] border border-[#1e293b] rounded shadow-lg z-50">
                  <Link
                    href="/settings/profile"
                    className="block px-4 py-2 text-sm text-stone-400 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                    onClick={() => setShowMenu(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href={profileUrl}
                    className="block px-4 py-2 text-sm text-stone-400 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                    onClick={() => setShowMenu(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#1e293b]"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="w-8 h-8 rounded-full bg-[#131b26] border border-[#1e293b] flex items-center justify-center hover:border-[#87ceeb] transition-colors"
            >
              <span className="text-xs font-bold text-[#87ceeb]">?</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#1e293b] mt-auto py-6 bg-[#0a0f16]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-stone-500">
        <p>© {new Date().getFullYear()} Tornamesa</p>
        <div className="flex gap-6">
          <Link href="#" className="hover:text-[#87ceeb] transition-colors">
            About
          </Link>
          <Link href="#" className="hover:text-[#87ceeb] transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500 bg-[#0a0f16]">
      {message}
    </div>
  );
}

export function ErrorMessage({ message, onDismiss }) {
  return (
    <div className="mb-4 p-3 bg-red-900/20 border border-red-800 text-red-300 text-sm flex justify-between rounded">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-300 hover:text-red-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function SuccessMessage({ message }) {
  return (
    <div className="mb-4 p-3 bg-green-900/20 border border-green-800 text-green-300 text-sm rounded">
      ✓ {message}
    </div>
  );
}

export default {
  Header,
  Footer,
  LoadingSpinner,
  ErrorMessage,
  SuccessMessage,
};
