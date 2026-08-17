"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import ReviewsList from "@/components/profile/ReviewsList";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function ReviewsInner({ username }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ratingFromUrl = searchParams.get("rating") || "all";

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const limit = 20;

  const ratingFilter = ratingFromUrl;

  const setRatingFilter = (v) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v === "all") params.delete("rating");
    else params.set("rating", String(v));
    router.replace(`/${username}/reviews?${params.toString()}`, {
      scroll: false,
    });
  };

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserReviews(
        username,
        limit,
        0,
        ratingFilter === "all" ? null : ratingFilter
      );
      const items = data.reviews || [];
      setReviews(items);
      setOffset(limit);
      setHasMore(items.length >= limit);
    } catch (err) {
      setError(err.message || "Could not load reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [username, ratingFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!username || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getUserReviews(
        username,
        limit,
        offset,
        ratingFilter === "all" ? null : ratingFilter
      );
      const more = data.reviews || [];
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...more.filter((r) => !seen.has(r.id))];
      });
      setOffset((prev) => prev + limit);
      setHasMore(more.length >= limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <LoadingSpinner message="Loading reviews..." />
      </div>
    );
  }

  return (
    <>
      {error && <ErrorMessage message={error} />}
      {!error && (
        <>
          <ReviewsList
            reviews={reviews}
            emptyMessage="This user hasn't written any reviews yet."
            showFilters
            username={username}
            ratingFilter={ratingFilter}
            onRatingFilterChange={setRatingFilter}
            query={query}
            onQueryChange={setQuery}
          />
          {hasMore && reviews.length > 0 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm text-[#7cc7e8] hover:underline disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function UserReviewsPage({ params }) {
  const raw = typeof params?.then === "function" ? null : params?.username;
  const [username, setUsername] = useState(raw);
  const { user } = useAuth();

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setUsername(p.username));
    } else if (params?.username) {
      setUsername(params.username);
    }
  }, [params]);

  if (!username) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] overflow-x-hidden">
      <Header user={user} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="mb-8">
          <Link
            href={`/${username}`}
            className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
          >
            ← @{username}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
            @{username}&apos;s reviews
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            All ratings and written reviews
          </p>
        </div>
        <Suspense fallback={<LoadingSpinner message="Loading reviews..." />}>
          <ReviewsInner username={username} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
