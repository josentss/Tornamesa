"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Header,
  Footer,
  ErrorMessage,
  LoadingSpinner,
  EmptyState,
} from "@/components/shared";
import Image from "next/image";
import Link from "next/link";

// ======================= AUTH MODALS =======================
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
      <div className="bg-[#131b26] border border-[#1e293b] rounded-lg p-6 w-full max-w-md relative shadow-2xl animate-[slide-up_0.2s_ease-out]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-500 hover:text-white font-bold transition-colors"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

const AuthModals = ({ showLogin, setShowLogin, showRegister, setShowRegister }) => {
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const resetStates = () => {
    setError("");
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setAcceptTerms(false);
    setCaptchaOk(false);
    setRememberMe(false);
  };

  const closeAll = () => {
    setShowLogin(false);
    setShowRegister(false);
    resetStates();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Email and password required");
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
      closeAll();
    } catch (err) {
      setError(err.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !username || !password || !confirmPassword)
      return setError("All fields are required");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6)
      return setError("Password must have at least 6 characters");
    if (!acceptTerms) return setError("You must accept the terms and conditions");
    if (!captchaOk) return setError("Please complete the security captcha");
    setLoading(true);
    try {
      await signUp(email, password, username);
      alert("Registered successfully. Please log in.");
      setShowRegister(false);
      setShowLogin(true);
      resetStates();
    } catch (err) {
      setError(err.message || "Error registering");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={showLogin} onClose={closeAll}>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">Log in</h2>
            <p className="text-stone-400 text-sm">Welcome back to Tornamesa</p>
          </div>
          {error && <ErrorMessage message={error} onDismiss={() => setError("")} />}
          <form onSubmit={handleLogin} className="space-y-4 flex flex-col">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3 h-3 rounded bg-[#0a0f16] border-[#1e293b]"
              />
              Remember me on this device
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#87ceeb] text-[#0a0f16] py-2 rounded font-bold hover:bg-white transition-all disabled:opacity-50 mt-2"
            >
              {loading ? "Entering..." : "Log In"}
            </button>
          </form>
          <div className="text-center text-sm text-stone-400">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => {
                setShowLogin(false);
                setShowRegister(true);
                resetStates();
              }}
              className="text-[#87ceeb] hover:text-white transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRegister} onClose={closeAll}>
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">Create account</h2>
            <p className="text-stone-400 text-sm">Join Tornamesa</p>
          </div>
          {error && <ErrorMessage message={error} onDismiss={() => setError("")} />}
          <form onSubmit={handleRegister} className="space-y-3 flex flex-col">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={loading}
                className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm"
                disabled={loading}
                className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
              />
            </div>
            <div className="bg-[#0a0f16] border border-[#1e293b] p-3 rounded flex items-center justify-between hover:border-[#87ceeb] transition-colors">
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={captchaOk}
                    onChange={(e) => setCaptchaOk(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 appearance-none bg-[#131b26] checked:bg-[#87ceeb] transition-colors"
                  />
                  {captchaOk && (
                    <span className="absolute text-[#0a0f16] text-xs font-bold pointer-events-none">
                      ✓
                    </span>
                  )}
                </div>
                I am not a robot
              </label>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-500 font-semibold tracking-wider">
                  reCAPTCHA
                </span>
                <span className="text-[8px] text-stone-600">Privacy - Terms</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-400 mt-2">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              I accept the terms of service and privacy policy.
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00e054] text-[#0a0f16] py-2 mt-2 rounded font-bold hover:bg-[#00c045] transition-all disabled:opacity-50"
            >
              {loading ? "Registering..." : "Sign Up"}
            </button>
          </form>
          <div className="text-center text-sm text-stone-400">
            Already have an account?{" "}
            <button
              onClick={() => {
                setShowRegister(false);
                setShowLogin(true);
                resetStates();
              }}
              className="text-[#87ceeb] hover:text-white transition-colors"
            >
              Log in
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// ======================= PUBLIC LANDING =======================

const PublicHeader = ({ onLogin, onRegister }) => (
  <header className="absolute top-0 w-full z-20 flex justify-between items-center px-6 py-4">
    <div className="text-xl font-bold tracking-tighter text-[#f0f9ff]">Tornamesa</div>
    <nav className="flex items-center gap-4 text-xs md:text-sm font-semibold tracking-wider">
      <button onClick={onLogin} className="text-stone-300 hover:text-white transition-colors">
        Log in
      </button>
      <button onClick={onRegister} className="text-stone-300 hover:text-white transition-colors">
        Create account
      </button>
    </nav>
  </header>
);

const LandingView = ({ onRegister }) => (
  <div className="flex-1 flex flex-col w-full bg-[#0a0f16]">
    <div className="relative w-full min-h-[75vh] flex flex-col justify-center px-6 md:px-12 lg:px-24 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/hero-bg.jpg"
          alt="Musical background"
          fill
          priority
          className="object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-[#0a0f16]/90 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-transparent to-transparent z-10" />
      </div>
      <div className="relative z-20 max-w-3xl space-y-8 mt-16">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.1]">
          <span className="text-[#f0f9ff]">Track the albums you listen to.</span>
          <br />
          <span className="text-stone-400">Save the ones you want to hear.</span>
          <br />
          <span className="text-[#87ceeb]">Share with friends what they play.</span>
        </h1>
        <p className="text-stone-400 max-w-xl text-lg font-light">
          Discover, rate, and share your love for music in this place.
        </p>
        <button
          onClick={onRegister}
          className="inline-block bg-[#87ceeb] text-[#0a0f16] px-8 py-3.5 rounded-md font-semibold hover:bg-white transition-all text-sm shadow-[0_0_15px_rgba(135,206,235,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        >
          Create free account
        </button>
      </div>
    </div>
    <div className="w-full max-w-6xl mx-auto px-6 py-16 relative z-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            🎧
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Track your music</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Keep an exact diary of every album you play and rate them.
          </p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            📌
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Review records</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Write about an album you have listened to.
          </p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            👥
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Interact with users</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Discover new music by exploring the recent activity of people you follow.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// ======================= DASHBOARD HELPERS =======================

function groupOwnHistory(history) {
  const map = {};
  (history || []).forEach((item) => {
    const album = item.albums;
    if (!album?.spotify_id) return;
    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    const key = `${day}_${album.spotify_id}`;
    if (!map[key]) {
      map[key] = {
        key,
        count: 0,
        rating: item.rating,
        listened_at: item.listened_at,
        album: {
          id: album.spotify_id,
          title: album.title,
          artist: album.artist,
          cover: album.cover_url,
        },
      };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.listened_at || "").localeCompare(a.listened_at || ""))
    .slice(0, 6);
}

function groupFriendsFeed(feed) {
  const map = {};
  (feed || []).forEach((item) => {
    if (!item.album_id) return;
    const key = `${item.username || "user"}_${item.album_id}`;
    if (!map[key]) {
      map[key] = { ...item, key, count: 0 };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.listened_at || "").localeCompare(a.listened_at || ""))
    .slice(0, 6);
}

const AlbumGridCard = ({
  href,
  cover,
  title,
  subtitle,
  rating,
  count,
  footerLeft,
}) => (
  <div className="group flex flex-col w-full min-w-0">
    <Link
      href={href}
      className="relative aspect-square w-full bg-[#131e2c] rounded-xl border border-[#2a3645] overflow-hidden transition-all duration-300 group-hover:border-[#7cc7e8]/40 shadow-sm"
    >
      {cover ? (
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full bg-[#1f2b3a]" />
      )}
      {rating != null && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/70 text-yellow-400 px-1.5 py-0.5 rounded">
          ★ {rating}
        </span>
      )}
    </Link>
    <div className="mt-2 min-w-0">
      <Link
        href={href}
        className="block text-xs font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors"
      >
        {title}
      </Link>
      {subtitle && (
        <p className="text-[10px] text-stone-500 truncate">{subtitle}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">{footerLeft}</div>
        {count > 1 && (
          <span className="text-[10px] font-bold text-[#7cc7e8] bg-[#0a121c] px-1.5 py-0.5 rounded border border-[#2a3645] flex-shrink-0">
            ×{count}
          </span>
        )}
      </div>
    </div>
  </div>
);

const FriendReviewCard = ({ review }) => (
  <Link
    href={`/album/${review.album.id}#reviews`}
    className="flex flex-col bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 hover:border-[#3d5068] transition-colors group h-full min-w-0"
  >
    <div className="flex gap-3 min-w-0">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0 relative">
        {review.album.cover && (
          <Image
            src={review.album.cover}
            alt={review.album.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
              {review.album.title}
            </p>
            <p className="text-[11px] text-stone-500 truncate">
              {review.album.artist}
            </p>
          </div>
          <span className="text-yellow-400 text-xs font-semibold flex-shrink-0">
            ★ {review.rating}
          </span>
        </div>
        {review.reviewText && (
          <p className="text-xs text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">
            {review.reviewText}
          </p>
        )}
      </div>
    </div>
    <div className="mt-2.5 pt-2 border-t border-[#2a3645]/80 flex items-center gap-1.5 min-w-0">
      <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center">
        {review.avatar_url ? (
          <Image
            src={review.avatar_url}
            alt={review.username}
            width={20}
            height={20}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-[9px] font-bold text-[#7cc7e8]">
            {(review.username || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-[11px] text-stone-400 truncate">
        @{review.username}
      </span>
    </div>
  </Link>
);

const DashboardView = ({
  username,
  feed,
  ownHistory,
  stats,
  friendsReviews,
  dataReady,
}) => {
  const ownGrouped = groupOwnHistory(ownHistory);
  const friendsGrouped = groupFriendsFeed(feed);
  const reviewsSix = (friendsReviews || []).slice(0, 6);

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14 overflow-x-hidden">
      <section className="bg-[#131e2c]/80 border border-[#2a3645] rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">
              Welcome back
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {username ? `@${username}` : "Your home"}
            </h1>
            <div className="flex flex-wrap gap-4 sm:gap-6 mt-3 text-sm">
              <div>
                <span className="text-white font-semibold">
                  {stats?.monthlyListens ?? 0}
                </span>{" "}
                <span className="text-stone-500 text-xs">this month</span>
              </div>
              <div>
                <span className="text-white font-semibold">
                  {stats?.yearlyListens ?? 0}
                </span>{" "}
                <span className="text-stone-500 text-xs">this year</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/search"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] transition-colors"
            >
              Search
            </Link>
            <Link
              href="/diary"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] hover:border-[#3d5068] transition-colors"
            >
              Diary
            </Link>
            {username && (
              <Link
                href={`/${username}`}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] hover:border-[#3d5068] transition-colors"
              >
                Profile
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Friends listens — no blocking spinner */}
      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            What your friends are listening to
          </h2>
        </div>
        {friendsGrouped.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
            {friendsGrouped.map((item) => (
              <AlbumGridCard
                key={item.key}
                href={`/album/${item.album_id}`}
                cover={item.album_cover}
                title={item.album_title}
                subtitle={item.artist_name}
                rating={item.rating}
                count={item.count}
                footerLeft={
                  <Link
                    href={`/${item.username}`}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center">
                      {item.avatar_url ? (
                        <Image
                          src={item.avatar_url}
                          alt={item.username}
                          width={20}
                          height={20}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-[#7cc7e8]">
                          {(item.username || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 hover:text-white truncate transition-colors">
                      {item.username}
                    </span>
                  </Link>
                }
              />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No recent activity from people you follow"
            description="Follow users to see what they are listening to."
            actionLabel="Find people or albums"
            actionHref="/search"
          />
        ) : null}
      </section>

      {/* Your recent activity */}
      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Your recent activity
          </h2>
          <Link href="/diary" className="text-xs text-[#7cc7e8] hover:underline">
            View diary
          </Link>
        </div>
        {ownGrouped.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
            {ownGrouped.map((entry) => (
              <AlbumGridCard
                key={entry.key}
                href={`/album/${entry.album.id}`}
                cover={entry.album.cover}
                title={entry.album.title}
                subtitle={entry.album.artist}
                rating={entry.rating}
                count={entry.count}
                footerLeft={
                  <span className="text-[10px] text-stone-500 truncate">You</span>
                }
              />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No listens yet"
            description="Log an album to start your diary."
            actionLabel="Log your first album"
            actionHref="/search"
          />
        ) : null}
      </section>

      {/* Friends reviews */}
      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Reviews from friends
          </h2>
        </div>
        {reviewsSix.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reviewsSix.map((review) => (
              <FriendReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No reviews from people you follow yet"
            description="When friends rate albums, their reviews will show up here."
          />
        ) : null}
      </section>
    </main>
  );
};

// ======================= PAGE =======================

export default function Page() {
  const { user, loading } = useAuth();
  const [feed, setFeed] = useState([]);
  const [ownHistory, setOwnHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [username, setUsername] = useState(null);
  const [dataReady, setDataReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (!user) {
      setDataReady(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        let uname = user.username || user.user_metadata?.username || null;
        if (!uname) {
          try {
            const profile = await api.getUserProfile(user.id);
            uname = profile?.username || null;
          } catch {
            /* ignore */
          }
        }

        const [feedRes, historyRes, statsRes, friendsReviewsRes] =
          await Promise.all([
            api.getFriendsFeed(user.id).catch(() => []),
            api.getUserHistory(user.id, 30, 0).catch(() => ({ history: [] })),
            uname
              ? api.getProfileStats(uname).catch(() => null)
              : Promise.resolve(null),
            api.getFriendsReviews(user.id).catch(() => []),
          ]);

        if (cancelled) return;

        setUsername(uname);
        setFeed(Array.isArray(feedRes) ? feedRes : []);
        setOwnHistory(historyRes.history || []);
        setStats(statsRes);
        setFriendsReviews(
          Array.isArray(friendsReviewsRes) ? friendsReviewsRes : []
        );
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        if (!cancelled) setDataReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Solo auth: evita flash de landing mientras se restaura la sesión
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <LoadingSpinner message="Loading..." fullScreen />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      {user ? (
        <Header user={user} />
      ) : (
        <PublicHeader
          onLogin={() => setShowLogin(true)}
          onRegister={() => setShowRegister(true)}
        />
      )}

      {user ? (
        <DashboardView
          username={username}
          feed={feed}
          ownHistory={ownHistory}
          stats={stats}
          friendsReviews={friendsReviews}
          dataReady={dataReady}
        />
      ) : (
        <LandingView onRegister={() => setShowRegister(true)} />
      )}

      <Footer />

      <AuthModals
        showLogin={showLogin}
        setShowLogin={setShowLogin}
        showRegister={showRegister}
        setShowRegister={setShowRegister}
      />
    </div>
  );
}
