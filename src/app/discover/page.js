"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage } from "@/components/shared";

function SharedTasteBlock({ sharedCount, sharedAlbums }) {
  if (!sharedCount && !sharedAlbums?.length) return null;

  const covers = (sharedAlbums || []).slice(0, 3);

  return (
    <div className="mt-3 w-full">
      <div className="flex items-center justify-center -space-x-2.5 mb-2 min-h-[40px]">
        {covers.map((a, i) => (
          <div
            key={a.id || i}
            className="relative w-10 h-10 rounded-md overflow-hidden border-2 border-[#131e2c] bg-[#0a121c] shadow-md"
            style={{ zIndex: 3 - i }}
            title={a.title ? `${a.title} — ${a.artist}` : undefined}
          >
            {a.cover ? (
              <Image
                src={a.cover}
                alt=""
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-[#1a2433]" />
            )}
          </div>
        ))}
      </div>
      {sharedCount > 0 && (
        <p className="text-center text-[11px] font-medium text-[#7cc7e8]/95 leading-tight">
          {sharedCount} in common
        </p>
      )}
    </div>
  );
}

function UserCard({ u, user, actionId, onToggle, showOverlap }) {
  return (
    <li className="flex flex-col items-center bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl px-3 pt-5 pb-4 hover:border-[#3d5068] transition-colors h-full">
      <Link
        href={`/${u.username}`}
        className="flex flex-col items-center w-full min-w-0 group"
      >
        <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden bg-[#0a121c] border border-[#2a3645] shrink-0 ring-2 ring-transparent group-hover:ring-[#7cc7e8]/30 transition">
          {u.avatar_url ? (
            <Image
              src={u.avatar_url}
              alt=""
              width={72}
              height={72}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-stone-500">
              {u.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <p className="mt-3 text-sm font-semibold text-white text-center truncate w-full px-1">
          {u.full_name || u.username}
        </p>
        <p className="text-xs text-stone-500 text-center truncate w-full px-1">
          @{u.username}
          {u.is_private ? " · Private" : ""}
        </p>

        {showOverlap && (
          <SharedTasteBlock
            sharedCount={u.sharedCount}
            sharedAlbums={u.sharedAlbums}
          />
        )}
      </Link>

      {!u.isSelf && (
        <button
          type="button"
          onClick={() => onToggle(u)}
          disabled={actionId === u.id}
          className={`mt-4 w-full max-w-[140px] text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
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
  if (!users.length) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {users.map((u) => (
        <UserCard
          key={u.id}
          u={u}
          user={user}
          actionId={actionId}
          onToggle={onToggle}
          showOverlap={showOverlap}
        />
      ))}
    </ul>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400 mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-stone-600 mb-4">{subtitle}</p>
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

  const handleFollowToggle = async (target) => {
    if (!user) return router.push("/auth/login");
    if (target.isSelf) return;
    setActionId(target.id);
    try {
      if (target.isFollowing) {
        await api.unfollowUser(user.id, target.id);
        const mark = (list) =>
          list.map((u) =>
            u.id === target.id ? { ...u, isFollowing: false } : u
          );
        setSimilar(mark);
        setActive(mark);
        setSearchUsers(mark);
      } else {
        await api.followUser(user.id, target.id);
        setSimilar((prev) => prev.filter((u) => u.id !== target.id));
        setActive((prev) => prev.filter((u) => u.id !== target.id));
        setSearchUsers((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: true } : u
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  };

  const skeleton = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-52 rounded-2xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
              <UserGrid
                users={searchUsers}
                user={user}
                actionId={actionId}
                onToggle={handleFollowToggle}
              />
            )}
          </Section>
        ) : (
          <>
            {user && (
              <Section
                title="Similar taste"
                subtitle="People who share albums you've logged"
              >
                {similar.length === 0 ? (
                  <p className="text-stone-500 text-sm py-4">
                    Log more albums to unlock better recommendations.
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
              title="Also active"
              subtitle="Recent listeners you don't follow yet"
            >
              {active.length === 0 ? (
                <p className="text-stone-500 text-sm py-4">
                  No one else to suggest right now.
                </p>
              ) : (
                <UserGrid
                  users={active}
                  user={user}
                  actionId={actionId}
                  onToggle={handleFollowToggle}
                />
              )}
            </Section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
