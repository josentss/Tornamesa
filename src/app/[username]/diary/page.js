"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import DiaryView from "@/components/profile/DiaryView";
import Link from "next/link";

export default function PublicDiaryPage({ params }) {
  const username =
    typeof params?.then === "function" ? null : params?.username;
  const [resolvedUsername, setResolvedUsername] = useState(username);
  const { user } = useAuth();

  const [period, setPeriod] = useState("all");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 50;

  const isOwner =
    !!(
      user?.username &&
      resolvedUsername &&
      user.username.toLowerCase() === resolvedUsername.toLowerCase()
    );

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setResolvedUsername(p.username));
    } else if (params?.username) {
      setResolvedUsername(params.username);
    }
  }, [params]);

  useEffect(() => {
    if (!resolvedUsername) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setForbidden(false);
        const data = await api.getPublicHistory(
          resolvedUsername,
          limit,
          0,
          user?.id || null
        );
        if (cancelled) return;
        const items = Array.isArray(data) ? data : data.history || [];
        setHistory(items);
        setOffset(limit);
        setHasMore(items.length >= limit);
      } catch (err) {
        if (cancelled) return;
        const msg = err.message || "Could not load diary";
        if (
          msg.toLowerCase().includes("private") ||
          msg.includes("403")
        ) {
          setForbidden(true);
          setError("This diary is private");
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedUsername, user?.id]);

  const handlePeriodChange = useCallback((p) => setPeriod(p), []);

  const loadMore = async () => {
    if (!resolvedUsername || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getPublicHistory(
        resolvedUsername,
        limit,
        offset,
        user?.id || null
      );
      const more = Array.isArray(data) ? data : data.history || [];
      setHistory((prev) => [...prev, ...more]);
      setOffset((prev) => prev + limit);
      setHasMore(more.length >= limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleHistoryPatch = (updated) => {
    if (!updated?.id) return;
    setHistory((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              listened_at: updated.listened_at,
              rating: updated.rating,
              review: updated.review,
            }
          : item
      )
    );
  };

  if (loading || !resolvedUsername) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading diary..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] overflow-x-hidden">
      <Header user={user} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 overflow-x-hidden">
        <div className="mb-8">
          <Link
            href={`/${resolvedUsername}`}
            className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
          >
            ← @{resolvedUsername}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
            @{resolvedUsername}&apos;s diary
          </h1>
          <p className="text-stone-400 text-sm mt-1">Full listening history</p>
        </div>

        {forbidden ? (
          <div className="bg-[#131e2c]/80 border border-[#2a3645] rounded-2xl p-8 text-center">
            <p className="text-stone-300 text-sm font-medium">
              This diary is private
            </p>
            <p className="text-stone-500 text-xs mt-2">
              The owner has chosen not to share their listening history.
            </p>
          </div>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <DiaryView
            history={history}
            period={period}
            onPeriodChange={handlePeriodChange}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            isOwner={isOwner}
            onHistoryPatch={isOwner ? handleHistoryPatch : undefined}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
