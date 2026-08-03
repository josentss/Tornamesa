"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import DiaryView from "@/components/profile/DiaryView";
import Link from "next/link";

export default function PublicDiaryPage({ params }) {
  const username =
    typeof params?.then === "function" ? null : params?.username;
  const [resolvedUsername, setResolvedUsername] = useState(username);
  const { user } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState("all");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 50;

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
        const data = await api.getPublicHistory(resolvedUsername, limit, 0);
        if (cancelled) return;
        // Compatible con respuesta array (vieja) u objeto { history }
        const items = Array.isArray(data) ? data : data.history || [];
        setHistory(items);
        setOffset(limit);
        setHasMore(items.length >= limit);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load diary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedUsername]);

  const handlePeriodChange = useCallback((p) => setPeriod(p), []);

  const loadMore = async () => {
    if (!resolvedUsername || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getPublicHistory(resolvedUsername, limit, offset);
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
        {error && <ErrorMessage message={error} />}
        {!error && (
          <DiaryView
            history={history}
            period={period}
            onPeriodChange={handlePeriodChange}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            isOwner={false}
            username={resolvedUsername}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
