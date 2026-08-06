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

    // Prefer live context values (updated via applyProfile / refreshUser)
    if (user.username) setUsername(user.username);
    if (user.avatar_url !== undefined) setAvatarUrl(user.avatar_url || null);

    // Always re-fetch so Header never sticks to a stale username
    let cancelled = false;
    api
      .getUserProfile(user.id)
      .then((data) => {
        if (cancelled || !data) return;
        if (data.username) setUsername(data.username);
        setAvatarUrl(data.avatar_url || null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.avatar_url]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowMenu(false);
      router.push('/');
      router.refresh();
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-[#131b26] border border-[#1e293b] rounded-lg shadow-lg z-50 overflow-hidden">
                    <Link
                      href={profileUrl}
                      className="block px-4 py-2.5 text-sm text-stone-400 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                      onClick={() => setShowMenu(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings/profile"
                      className="block px-4 py-2.5 text-sm text-stone-400 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                      onClick={() => setShowMenu(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-[#1e293b]"
                    >
                      Sign out
                    </button>
                  </div>
                </>
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

export function LoadingSpinner({ message = 'Loading...', fullScreen = false }) {
  const body = (
    <div className="flex flex-col items-center justify-center gap-3 text-stone-500">
      <div
        className="w-8 h-8 border-2 border-[#2a3645] border-t-[#7cc7e8] rounded-full animate-spin"
        aria-hidden
      />
      <p className="text-sm">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f16]">
        {body}
      </div>
    );
  }

  return <div className="py-16 flex items-center justify-center">{body}</div>;
}

export function ErrorMessage({ message, onDismiss, action }) {
  return (
    <div className="mb-4 p-4 bg-red-900/20 border border-red-800/60 text-red-300 text-sm rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <span className="min-w-0">{message}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-300 hover:text-red-100 px-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  actionLabel,
  actionHref,
  onAction,
}) {
  return (
    <div className="py-12 sm:py-14 px-4 text-center bg-[#131e2c]/50 border border-[#2a3645] rounded-xl">
      <p className="text-stone-300 text-sm font-medium">{title}</p>
      {description && (
        <p className="text-stone-500 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {(actionHref || onAction) && (
        <div className="mt-4">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-block text-xs font-semibold text-[#7cc7e8] hover:underline"
            >
              {actionLabel || 'Explore'}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="text-xs font-semibold text-[#7cc7e8] hover:underline"
            >
              {actionLabel || 'Try again'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SuccessMessage({ message }) {
  return (
    <div className="mb-4 p-3 bg-green-900/20 border border-green-800 text-green-300 text-sm rounded-xl">
      ✓ {message}
    </div>
  );
}

export default {
  Header,
  Footer,
  LoadingSpinner,
  ErrorMessage,
  EmptyState,
  SuccessMessage,
};
