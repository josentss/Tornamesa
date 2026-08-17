"use client";

import { useMemo, useState } from "react";
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

function reviewHref(review) {
  const id = review.album?.id;
  if (!id) return "#";
  return `/album/${id}#review-${review.id}`;
}

function StarRatingFilter({ value, onChange, size = "sm" }) {
  const [hovered, setHovered] = useState(0);
  const selected =
    value === "all" || value == null || value === "" ? 0 : Number(value);
  const display = hovered || selected || 0;
  const starSize = size === "sm" ? "w-5 h-5" : "w-6 h-6";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
          selected === 0
            ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/50 text-[#7cc7e8]"
            : "border-[#2a3645] text-stone-500 hover:text-stone-300"
        }`}
      >
        All
      </button>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(0)}
      >
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const active = n <= display;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              onMouseEnter={() => setHovered(n)}
              className={`${starSize} flex items-center justify-center transition-transform hover:scale-110 focus:outline-none`}
              aria-label={`Filter ${n} stars`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-full h-full transition-colors duration-100 ${
                  active
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-transparent text-stone-600"
                }`}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
        {selected > 0 && (
          <span className="ml-1.5 text-xs font-semibold text-yellow-400 tabular-nums">
            {selected}/10
          </span>
        )}
      </div>
    </div>
  );
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
        <div className="w-16 h-16 rounded-full bg-[#1f2b3a] flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-stone-500"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </div>
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
          <StarRatingFilter
            value={String(ratingFilter)}
            onChange={setRatingFilter}
          />
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
            const href = reviewHref(review);
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
