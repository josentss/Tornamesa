"use client";

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

export default function ReviewsList({ reviews, emptyMessage }) {
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
    <div className="space-y-3">
      {reviews.map((review) => (
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

            <div className="flex-1 min-w-0">
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

              {review.reviewText && (
                <p className="text-sm text-stone-300 mt-2 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                  {review.reviewText}
                </p>
              )}

              <p className="text-[10px] text-stone-500 mt-2">
                {formatDate(review.createdAt)}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
