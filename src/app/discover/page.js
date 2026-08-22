"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage } from "@/components/shared";

function SharedTasteBlock({ sharedCount, sharedAlbums }) {
  const covers = (sharedAlbums || []).slice(0, 3);
  const hasData = sharedCount > 0 || covers.length > 0;

  return (
    <div className="mt-2.5 w-full min-h-[52px] flex flex-col items-center justify-start">
      {hasData ? (
        <>
          {covers.length > 0 && (
            <div className="flex items-center justify-center -space-x-2 mb-1.5">
              {covers.map((a, i) => (
                <div
                  key={a.id || i}
                  className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-md overflow-hidden border-2 border-[#131e2c] bg-[#0a121c] shadow-md"
                  style={{ zIndex: 3 - i }}
                  title={a.title ? `${a.title} — ${a.artist}` : undefined}
                >
                  {a.cover ? (
                    <Image
                      src={a.cover}
                      alt=""
                      width={36}
                      height={36}
                      sizes="36px"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a2433]" />
                  )}
                </div>
              ))}
            </div>
          )}
          {sharedCount > 0 && (
            <p className="text-center text-[10px] sm:text-[11px] font-medium text-[#7cc7e8]/95 leading-tight">
              {sharedCount} in common
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-[10px] sm:text-[11px] text-stone-600 leading-tight pt-2">
          Nothing in common
        </p>
      )}
    </div>
  );
}

function UserCard({ u, user, actionId, onToggle, showOverlap }) {
  return (
    <li className="flex flex-col items-center bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl px-3 pt-4 pb-3.5 hover:border-[#3d5068] transition-colors w-[140px] sm:w-full sm:max-w-[180px] sm:mx-auto flex-shrink-0 min-h-[248px] sm:min-h-[260px]">
      <Link
        href={`/${u.username}`}
        className="flex flex-col items-center w-full min-w-0 flex-1 group"
      >
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-[#0a121c] border border-[#2a3645] shrink-0 ring-2 ring-transparent group-hover:ring-[#7cc7e8]/30 transition">
          {u.avatar_url ? (
            <Image
              src={u.avatar_url}
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-base sm:text-lg font-bold text-stone-500">
              {u.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <p className="mt-2.5 text-sm font-semibold text-white text-center truncate w-full px-0.5">
          {u.full_name || u.username}
        </p>
        <p className="text-[11px] sm:text-xs text-stone-500 text-center truncate w-full px-0.5">
          @{u.username}
          {u.is_private ? " · Private" : ""}
        </p>

        {showOverlap ? (
          <SharedTasteBlock
            sharedCount={u.sharedCount}
            sharedAlbums={u.sharedAlbums}
          />
        ) : (
          <div className="mt-2.5 min-h-[52px]" aria-hidden />
        )}
      </Link>

      {!u.isSelf && (
        <button
          type="button"
          onClick={() => onToggle(u)}
          disabled={actionId === u.id}
          className={`mt-auto w-full max-w-[130px] text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
            u.isFollowing
              ? "bg-transparent border-[#2a3645] text-stone-300 hover:border-stone-400"
              : "bg-[#7cc7e8] text-[#0a121c] border-transparent hover:bg-[#a5d8f0]"
          } disabled:opacity-50`}
        >
          {!user
            ? "Follow"
            : actionId === u.id
              ? "..."
              : u.isFollowing
                ? "Following"
                : "Follow"}
        </button>
      )}
    </li>
  );
}

function UserGrid({ users, user, actionId, onToggle, showOverlap }) {
  const scrollerRef = useRef(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      setShowFade(false);
      return;
    }

    const update = () => {
      const canScroll = el.scrollWidth > el.clientWidth + 8;
      const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 8;
      setShowFade(canScroll && notAtEnd);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const t = setTimeout(update, 120);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(t);
    };
  }, [users]);

  if (!users.length) return null;

  const renderCards = () =>
    users.map((u) => (
      <UserCard
        key={u.id}
        u={u}
        user={user}
        actionId={actionId}
        onToggle={onToggle}
        showOverlap={showOverlap}
      />
    ));

  return (
    <>
      <div className="sm:hidden relative max-w-full">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-[#0a0f16] to-transparent transition-opacity duration-200 ${
            showFade ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          ref={scrollerRef}
          className="overflow-x-auto overscroll-x-contain scrollbar-none pb-1"
        >
          <ul className="flex gap-3 w-max">{renderCards()}</ul>
        </div>
      </div>

      <ul className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {renderCards()}
      </ul>
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
      {subtitle ? (
        <p className="text-xs text-stone-600 mb-4 mt-1">{subtitle}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  );
}

async function resolveUserId(user) {
  if (user?.id) return user.id;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mode, setMode] = useState("recommend");
  const [similar, setSimilar] = useState([]);
  const [searchUsers, setSearchUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.discoverUsers(debouncedQ, user?.id, 12, 0);
      setMode(data.mode || (debouncedQ ? "search" : "recommend"));
      setSimilar(data.similar || []);
      setSearchUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Could not load users");
      setSimilar([]);
      setSearchUsers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowToggle = async (target) => {
    if (target.isSelf) return;

    const uid = await resolveUserId(user);
    if (!uid) {
      router.push("/auth/login");
      return;
    }

    setActionId(target.id);
    try {
      if (target.isFollowing) {
        await api.unfollowUser(uid, target.id);
        setSimilar((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: false } : u
          )
        );
        setSearchUsers((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: false } : u
          )
        );
      } else {
        await api.followUser(uid, target.id);
        setSimilar((prev) => prev.filter((u) => u.id !== target.id));
        setSearchUsers((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: true } : u
          )
        );
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not update follow");
    } finally {
      setActionId(null);
    }
  };

  const skeleton = (
    <>
      <div className="sm:hidden overflow-x-auto scrollbar-none pb-1">
        <div className="flex gap-3 w-max">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[140px] h-44 flex-shrink-0 rounded-2xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-44 max-w-[180px] mx-auto w-full rounded-2xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
          />
        ))}
      </div>
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] overflow-x-hidden">
      <Header user={user} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Discover people
        </h1>
        <p className="text-stone-400 text-sm mt-1.5">
          Find listeners who share your top-rated albums
        </p>

        <div className="mt-6 mb-8">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name..."
            className="w-full bg-[#131e2c] border border-[#2a3645] rounded-xl px-4 py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
            autoComplete="off"
          />
        </div>

        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {loading ? (
          skeleton
        ) : mode === "search" ? (
          <Section
            title="Results"
            subtitle={debouncedQ ? `“${debouncedQ}”` : null}
          >
            {searchUsers.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-12">
                No users found.
              </p>
            ) : (
              <UserGrid
                users={searchUsers}
                user={user}
                actionId={actionId}
                onToggle={handleFollowToggle}
                showOverlap={!!user}
              />
            )}
          </Section>
        ) : (
          <>
            {user ? (
              <Section
                title="Similar taste"
                subtitle="People who also logged albums you rated 10/10"
              >
                {similar.length === 0 ? (
                  <p className="text-stone-500 text-sm py-4">
                    Rate more albums with 10 stars to unlock recommendations.
                  </p>
                ) : (
                  <UserGrid
                    users={similar}
                    user={user}
                    actionId={actionId}
                    onToggle={handleFollowToggle}
                    showOverlap
                  />
                )}
              </Section>
            ) : (
              <p className="text-sm text-stone-500">
                <Link
                  href="/auth/login"
                  className="text-[#7cc7e8] hover:underline"
                >
                  Sign in
                </Link>{" "}
                to see people with similar 10/10 albums.
              </p>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
