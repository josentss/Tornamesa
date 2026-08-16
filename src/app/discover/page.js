"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage } from "@/components/shared";

function SharedCovers({ albums }) {
  if (!albums?.length) return null;
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {albums.slice(0, 3).map((a) => (
        <div
          key={a.id}
          className="relative w-7 h-7 rounded overflow-hidden border border-[#2a3645] bg-[#0a121c] shrink-0"
          title={`${a.title} — ${a.artist}`}
        >
          {a.cover ? (
            <Image
              src={a.cover}
              alt=""
              width={28}
              height={28}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full bg-[#1a2433]" />
          )}
        </div>
      ))}
    </div>
  );
}

function UserRow({ u, user, actionId, onToggle, showOverlap }) {
  return (
    <li className="flex items-center gap-3 sm:gap-4 bg-[#131e2c]/80 border border-[#2a3645] rounded-xl px-3 sm:px-4 py-3 hover:border-[#3d5068] transition-colors">
      <Link
        href={`/${u.username}`}
        className="flex items-center gap-3 min-w-0 flex-1"
      >
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-[#0a121c] border border-[#2a3645] shrink-0">
          {u.avatar_url ? (
            <Image
              src={u.avatar_url}
              alt=""
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-stone-500">
              {u.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {u.full_name || u.username}
          </p>
          <p className="text-xs text-stone-500 truncate">
            @{u.username}
            {u.is_private && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-stone-600">
                Private
              </span>
            )}
          </p>
          {showOverlap && u.sharedCount > 0 && (
            <p className="text-[11px] text-[#7cc7e8]/90 mt-0.5">
              {u.sharedCount} album{u.sharedCount === 1 ? "" : "s"} in common
            </p>
          )}
          {showOverlap && <SharedCovers albums={u.sharedAlbums} />}
        </div>
      </Link>

      {!u.isSelf && (
        <button
          type="button"
          onClick={() => onToggle(u)}
          disabled={actionId === u.id}
          className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-lg border transition-all ${
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

function Section({ title, subtitle, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400 mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-stone-600 mb-3">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mode, setMode] = useState("recommend");
  const [similar, setSimilar] = useState([]);
  const [active, setActive] = useState([]);
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
      setActive(data.active || []);
      setSearchUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Could not load users");
      setSimilar([]);
      setActive([]);
      setSearchUsers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFollow = (list, setList, target, isFollowing) => {
    setList(
      list.map((u) => (u.id === target.id ? { ...u, isFollowing } : u))
    );
  };

  const handleFollowToggle = async (target) => {
    if (!user) return router.push("/auth/login");
    if (target.isSelf) return;
    setActionId(target.id);
    try {
      if (target.isFollowing) {
        await api.unfollowUser(user.id, target.id);
        updateFollow(similar, setSimilar, target, false);
        updateFollow(active, setActive, target, false);
        updateFollow(searchUsers, setSearchUsers, target, false);
      } else {
        await api.followUser(user.id, target.id);
        setSimilar((prev) => prev.filter((u) => u.id !== target.id));
        updateFollow(active, setActive, target, true);
        updateFollow(searchUsers, setSearchUsers, target, true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const skeleton = (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-20 rounded-xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Discover people
        </h1>
        <p className="text-stone-400 text-sm mt-1.5">
          Find listeners with similar taste
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
              <ul className="space-y-2">
                {searchUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    user={user}
                    actionId={actionId}
                    onToggle={handleFollowToggle}
                  />
                ))}
              </ul>
            )}
          </Section>
        ) : (
          <>
            {user && (
              <Section
                title="Similar taste"
                subtitle="Based on albums you both have logged"
              >
                {similar.length === 0 ? (
                  <p className="text-stone-500 text-sm py-4">
                    Log more albums (or follow fewer people in this list) to see
                    new recommendations.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {similar.map((u) => (
                      <UserRow
                        key={u.id}
                        u={u}
                        user={user}
                        actionId={actionId}
                        onToggle={handleFollowToggle}
                        showOverlap
                      />
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {!user && (
              <p className="text-sm text-stone-500 mb-8">
                <Link
                  href="/auth/login"
                  className="text-[#7cc7e8] hover:underline"
                >
                  Sign in
                </Link>{" "}
                to see people with similar taste.
              </p>
            )}

            <Section
              title="Active lately"
              subtitle="Listeners with activity in the last 2 weeks"
            >
              {active.length === 0 ? (
                <p className="text-stone-500 text-sm py-4">
                  No recent activity to show.
                </p>
              ) : (
                <ul className="space-y-2">
                  {active.map((u) => (
                    <UserRow
                      key={u.id}
                      u={u}
                      user={user}
                      actionId={actionId}
                      onToggle={handleFollowToggle}
                    />
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
