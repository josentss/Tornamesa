"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function reviewHref(review, username) {
  const id = review.album?.id;
  if (!id) return "#";
  const params = new URLSearchParams();
  if (username) params.set("from", username);
  if (review.id) params.set("review", String(review.id));
  const q = params.toString();
  return `/album/${id}${q ? `?${q}` : ""}#review-${review.id || "user"}`;
}

function ReviewText({ text, href }) {
  if (!text) return null;
  const isLong = text.length > 180 || text.split("\n").length > 3;
  if (!isLong) {
    return (
      <p className="text-sm text-stone-300 mt-2 leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </p>
    );
  }
  const preview =
    text.length > 180
      ? text.slice(0, 180).trim() + "…"
      : text.split("\n").slice(0, 3).join("\n") + "…";
  return (
    <div className="mt-2">
      <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap break-words">
        {preview}
      </p>
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-[#7cc7e8] hover:underline mt-1 inline-block"
      >
        Read more
      </Link>
    </div>
  );
}

function RatingStarFilter({ value, onChange }) {
  const ratings = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
          value === "all"
            ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/50 text-[#7cc7e8]"
            : "border-[#2a3645] text-stone-500 hover:text-stone-300"
        }`}
      >
        All
      </button>
      {ratings.map((n) => {
        const active = value === String(n) || value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            title={`${n}/10`}
            className={`w-7 h-7 rounded-md text-[11px] font-semibold border transition-colors ${
              active
                ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-300"
                : "border-[#2a3645] text-stone-500 hover:border-yellow-400/30 hover:text-yellow-400/80"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewsList({
  reviews,
  emptyMessage,
  showFilters = false,
  username = null,
  ratingFilter: controlledRating,
  onRatingFilterChange,
  query: controlledQuery,
  onQueryChange,
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [localRating, setLocalRating] = useState("all");

  const query = controlledQuery !== undefined ? controlledQuery : localQuery;
  const ratingFilter =
    controlledRating !== undefined ? controlledRating : localRating;

  const setQuery = (v) => {
    if (onQueryChange) onQueryChange(v);
    else setLocalQuery(v);
  };
  const setRatingFilter = (v) => {
    if (onRatingFilterChange) onRatingFilterChange(v);
    else setLocalRating(v);
  };

  const filtered = useMemo(() => {
    let list = reviews || [];
    if (controlledRating === undefined && ratingFilter !== "all") {
      const n = Number(ratingFilter);
      list = list.filter((r) => Number(r.rating) === n);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.album?.title?.toLowerCase().includes(q) ||
          r.album?.artist?.toLowerCase().includes(q) ||
          r.reviewText?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, query, ratingFilter, controlledRating]);

  if ((!reviews || reviews.length === 0) && !showFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-stone-400 text-sm font-medium">No reviews yet</p>
        <p className="text-stone-500 text-xs mt-1 max-w-[240px]">
          {emptyMessage || "Reviews will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {showFilters && (
        <div className="flex flex-col gap-3 mb-6 w-full min-w-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search album, artist or text..."
            className="w-full min-w-0 bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
          />
          <RatingStarFilter value={String(ratingFilter)} onChange={setRatingFilter} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-8 text-center">
          <p className="text-stone-400 text-sm">
            {reviews?.length
              ? "No reviews match your filters"
              : emptyMessage || "No reviews yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const href = reviewHref(review, username);
            return (
              <Link
                key={review.id}
                href={href}
                className="block bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 sm:p-4 hover:border-[#3d5068] transition-colors group"
              >
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
                    {review.album?.cover ? (
                      <Image
                        src={review.album.cover}
                        alt={review.album.title || ""}
                        width={56}
                        height={56}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600 text-[10px]">
                        —
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                          {review.album?.title || "Unknown album"}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          {review.album?.artist || ""}
                        </p>
                      </div>
                      <span className="text-yellow-400 text-sm font-semibold flex-shrink-0">
                        ★ {review.rating}/10
                      </span>
                    </div>
                    <ReviewText text={review.reviewText} href={href} />
                    <p className="text-[10px] text-stone-500 mt-2">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
