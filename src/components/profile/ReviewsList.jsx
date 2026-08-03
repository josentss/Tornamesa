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

function ReviewText({ text, albumId }) {
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
    text.length > 180 ? text.slice(0, 180).trim() + "…" : text.split("\n").slice(0, 3).join("\n") + "…";

  return (
    <div className="mt-2">
      <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap break-words">
        {preview}
      </p>
      <Link
        href={`/album/${albumId}#reviews`}
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
}) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = reviews || [];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.album?.title?.toLowerCase().includes(q) ||
          r.album?.artist?.toLowerCase().includes(q) ||
          r.reviewText?.toLowerCase().includes(q)
      );
    }

    if (ratingFilter !== "all") {
      const n = Number(ratingFilter);
      list = list.filter((r) => r.rating === n);
    }

    return list;
  }, [reviews, query, ratingFilter]);

  if (!reviews || reviews.length === 0) {
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-6 w-full min-w-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search album, artist or text..."
            className="w-full min-w-0 flex-1 bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
          />
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="w-full sm:w-auto sm:min-w-[130px] bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-[#7cc7e8]"
          >
            <option value="all">All ratings</option>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
              <option key={n} value={n}>
                ★ {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-8 text-center">
          <p className="text-stone-400 text-sm">No reviews match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <Link
              key={review.id}
              href={`/album/${review.album.id}`}
              className="block bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 sm:p-4 hover:border-[#3d5068] transition-colors group"
            >
              <div className="flex gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
                  {review.album.cover ? (
                    <Image
                      src={review.album.cover}
                      alt={review.album.title}
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
                        {review.album.title}
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        {review.album.artist}
                      </p>
                    </div>
                    <span className="text-yellow-400 text-sm font-semibold flex-shrink-0">
                      ★ {review.rating}/10
                    </span>
                  </div>

                  <ReviewText text={review.reviewText} albumId={review.album.id} />

                  <p className="text-[10px] text-stone-500 mt-2">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
