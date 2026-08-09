"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import DiaryView from "@/components/profile/DiaryView";

function DiaryContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPeriod = searchParams.get("period") || "all";
  const [period, setPeriod] = useState(
    ["all", "year", "month"].includes(initialPeriod) ? initialPeriod : "all"
  );
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 50;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getUserHistory(user.id, limit, 0);
        if (cancelled) return;
        const items = data.history || [];
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
  }, [user, authLoading, router]);

  const handlePeriodChange = useCallback(
    (p) => {
      setPeriod(p);
      const url = p === "all" ? "/diary" : `/diary?period=${p}`;
      router.replace(url, { scroll: false });
    },
    [router]
  );

  const loadMore = async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getUserHistory(user.id, limit, offset);
      const more = data.history || [];
      setHistory((prev) => [...prev, ...more]);
      setOffset((prev) => prev + limit);
      setHasMore(more.length >= limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Loading diary..." />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Diary</h1>
        <p className="text-stone-400 text-sm mt-1">Your listening history</p>
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
          isOwner
        />
      )}
    </main>
  );
}

export default function DiaryPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] overflow-x-hidden">
      <Header user={user} />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="Loading diary..." />
          </div>
        }
      >
        <DiaryContent />
      </Suspense>
      <Footer />
    </div>
  );
}
