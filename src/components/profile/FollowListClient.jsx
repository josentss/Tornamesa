"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage } from "@/components/shared";

export default function FollowListClient({ username: rawUsername, initialTab }) {
  const username =
    typeof rawUsername === "string" ? rawUsername : rawUsername?.username;
  const [resolvedUsername, setResolvedUsername] = useState(
    typeof rawUsername === "string" ? rawUsername : null
  );
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState(initialTab === "following" ? "following" : "followers");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    if (rawUsername && typeof rawUsername.then === "function") {
      rawUsername.then((p) => setResolvedUsername(p.username));
    } else if (typeof rawUsername === "string") {
      setResolvedUsername(rawUsername);
    } else if (rawUsername?.username) {
      setResolvedUsername(rawUsername.username);
    }
  }, [rawUsername]);

  const load = useCallback(async () => {
    if (!resolvedUsername) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        tab === "following"
          ? await api.getFollowing(resolvedUsername, user?.id)
          : await api.getFollowers(resolvedUsername, user?.id);
      setUsers(data.users || []);
      setTotal(data.total ?? (data.users || []).length);
    } catch (err) {
      setError(err.message || "Could not load list");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedUsername, tab, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const switchTab = (next) => {
    setTab(next);
    const path =
      next === "following"
        ? `/${resolvedUsername}/following`
        : `/${resolvedUsername}/followers`;
    router.replace(path);
  };

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

  if (!resolvedUsername) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-40 bg-[#1f2b3a] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href={`/${resolvedUsername}`}
          className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
        >
          ← @{resolvedUsername}
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
          @{resolvedUsername}
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-[#2a3645] mt-6 mb-6">
          {[
            { id: "followers", label: "Followers" },
            { id: "following", label: "Following" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`pb-3 px-4 text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                tab === t.id
                  ? "border-[#7cc7e8] text-[#7cc7e8]"
                  : "border-transparent text-stone-400 hover:text-white"
              }`}
            >
              {t.label}
              {tab === t.id && total > 0 && (
                <span className="ml-1.5 text-xs font-normal text-stone-500">
                  {total}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[#131e2c] border border-[#2a3645] animate-pulse"
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">
              {tab === "followers"
                ? "No followers yet."
                : "Not following anyone yet."}
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
                        sizes="48px"
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

                {!u.isSelf && user && (
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
                    {actionId === u.id
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
