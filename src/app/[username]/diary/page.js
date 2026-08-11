"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import {
  Header,
  Footer,
  LoadingSpinner,
  ErrorMessage,
} from "@/components/shared";
import { api } from "@/lib/api";
import DiaryView from "@/components/profile/DiaryView";

function DiaryContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const username = String(params?.username || "").trim();

  const initialPeriod = searchParams.get("period") || "all";
  const [period, setPeriod] = useState(
    ["all", "year", "month"].includes(initialPeriod) ? initialPeriod : "all"
  );
  const [history, setHistory] = useState([]);
  const [displayName, setDisplayName] = useState(username);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const limit = 50;

  const myUsername = (
    profile?.username ||
    user?.username ||
    user?.user_metadata?.username ||
    ""
  )
    .toString()
    .toLowerCase();

  useEffect(() => {
    if (authLoading) return;
    if (!username) {
      setError("User not found");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const ownerByName =
          !!user?.id &&
          !!myUsername &&
          myUsername === username.toLowerCase();

        let items = [];
        let owner = ownerByName;

        if (ownerByName && user?.id) {
          const data = await api.getUserHistory(user.id, limit, 0);
          items = data.history || [];
          owner = true;
          setDisplayName(myUsername || username);
        } else {
          const data = await api.getPublicHistory(
            username,
            limit,
            0,
            user?.id || null
          );
          items = data.history || [];
          setDisplayName(data.username || username);
          if (data.userId && user?.id) {
            owner = data.userId === user.id;
          }
        }

        if (cancelled) return;
        setIsOwner(owner);
        setHistory(items);
        setOffset(limit);
        setHasMore(items.length >= limit);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load diary");
          setHistory([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [username, user?.id, myUsername, authLoading]);

  const handlePeriodChange = useCallback(
    (p) => {
      setPeriod(p);
      const base = `/${encodeURIComponent(username)}/diary`;
      const url = p === "all" ? base : `${base}?period=${p}`;
      router.replace(url, { scroll: false });
    },
    [router, username]
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || !username) return;
    setLoadingMore(true);
    try {
      let more = [];
      if (isOwner && user?.id) {
        const data = await api.getUserHistory(user.id, limit, offset);
        more = data.history || [];
      } else {
        const data = await api.getPublicHistory(
          username,
          limit,
          offset,
          user?.id || null
        );
        more = data.history || [];
      }
      setHistory((prev) => [...prev, ...more]);
      setOffset((prev) => prev + limit);
      setHasMore(more.length >= limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleHistoryPatch = useCallback((updated) => {
    if (!updated?.id) return;
    setHistory((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              listened_at: updated.listened_at ?? item.listened_at,
              rating:
                updated.rating !== undefined ? updated.rating : item.rating,
              review:
                updated.review !== undefined ? updated.review : item.review,
            }
          : item
      )
    );
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Loading diary..." />
      </div>
    );
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {isOwner ? "Diary" : `${displayName}'s diary`}
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {isOwner
            ? "Your listening history"
            : `Listening history of @${displayName}`}
        </p>
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
          isOwner={isOwner}
          onHistoryPatch={isOwner ? handleHistoryPatch : undefined}
        />
      )}
    </main>
  );
}

export default function UserDiaryPage() {
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
