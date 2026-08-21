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

    if (user.username) setUsername(user.username);
    if (user.avatar_url !== undefined) {
      setAvatarUrl(user.avatar_url || null);
    } else if (user.user_metadata?.username && !user.username) {
      setUsername(user.user_metadata.username);
    }

    let cancelled = false;
    api
      .getUserProfile(user.id)
      .then((data) => {
        if (cancelled || !data) return;
        if (data.username) setUsername(data.username);
        setAvatarUrl(data.avatar_url || null);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error loading header profile:', err);
        }
      });

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

          <Link
            href="/discover"
            className="text-stone-400 hover:text-[#87ceeb] transition-colors"
            title="Discover people"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3s1.34 3 3 3m-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5S5 6.34 5 8s1.34 3 3 3m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5m8 0c-.29 0-.62.02-.97.05c1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5" />
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
                      className="block px-4 py-2.5 text-sm text-stone-300 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                      onClick={() => setShowMenu(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/diary"
                      className="block px-4 py-2.5 text-sm text-stone-300 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                      onClick={() => setShowMenu(false)}
                    >
                      Diary
                    </Link>
                    {username && (
                      <Link
                        href={`/${username}/monthly-top`}
                        className="block px-4 py-2.5 text-sm text-stone-300 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                        onClick={() => setShowMenu(false)}
                      >
                        Monthly top
                      </Link>
                    )}
                    <Link
                      href="/settings/profile"
                      className="block px-4 py-2.5 text-sm text-stone-300 hover:text-[#87ceeb] hover:bg-[#1e293b]"
                      onClick={() => setShowMenu(false)}
                    >
                      Settings
                    </Link>
                    <div className="border-t border-[#1e293b]" />
                    <button
                      type="button"
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

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link
            href="/privacy"
            className="hover:text-[#87ceeb] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-[#87ceeb] transition-colors"
          >
            Terms
          </Link>
          <a
            href="https://github.com/josentss/Tornamesa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-stone-500 hover:text-[#87ceeb] transition-colors"
            aria-label="Tornamesa on GitHub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
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
