"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage } from "@/components/shared";

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.discoverUsers(debouncedQ, user?.id, 24, 0);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Could not load users");
      setUsers([]);
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
        setUsers((prev) =>
          prev.map((u) =>
            u.id === target.id ? { ...u, isFollowing: false } : u
          )
        );
      } else {
        await api.followUser(user.id, target.id);
        setUsers((prev) =>
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

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Discover people
        </h1>
        <p className="text-stone-400 text-sm mt-1.5">
          Find listeners to follow on Tornamesa
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">
              {debouncedQ
                ? `No users found for “${debouncedQ}”.`
                : "No users to show yet."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 sm:gap-4 bg-[#131e2c]/80 border border-[#2a3645] rounded-xl px-3 sm:px-4 py-3 hover:border-[#3d5068] transition-colors"
              >
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
                  </div>
                </Link>

                {!u.isSelf && (
                  <button
                    type="button"
                    onClick={() => handleFollowToggle(u)}
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
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
