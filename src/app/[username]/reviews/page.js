"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import ReviewsList from "@/components/profile/ReviewsList";
import Link from "next/link";

export default function UserReviewsPage({ params }) {
  const raw = typeof params?.then === "function" ? null : params?.username;
  const [username, setUsername] = useState(raw);
  const { user } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setUsername(p.username));
    } else if (params?.username) {
      setUsername(params.username);
    }
  }, [params]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getUserReviews(username, limit, 0);
        if (cancelled) return;
        const items = data.reviews || [];
        setReviews(items);
        setOffset(limit);
        setHasMore(items.length >= limit);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load reviews");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const loadMore = async () => {
    if (!username || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getUserReviews(username, limit, offset);
      const more = data.reviews || [];
      setReviews((prev) => [...prev, ...more]);
      setOffset((prev) => prev + limit);
      setHasMore(more.length >= limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading || !username) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading reviews..." />
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
          <p className="text-stone-400 text-sm mt-1">All ratings and written reviews</p>
        </div>

        {error && <ErrorMessage message={error} />}
        {!error && (
          <>
            <ReviewsList
              reviews={reviews}
              emptyMessage="This user hasn't written any reviews yet."
              showFilters
            />
            {hasMore && reviews.length > 0 && (
              <div className="mt-8 text-center">
                <button
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
      </main>
      <Footer />
    </div>
  );
}
