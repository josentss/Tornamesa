"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";

function formatDate(isoDay) {
  if (!isoDay || isoDay === "Unknown") return "Unknown date";
  const d = new Date(isoDay + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function StarRating({ value, onChange, size = "md" }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value || 0;
  const starSize = size === "sm" ? "w-5 h-5" : "w-6 h-6";

  return (
    <div
      className="flex flex-wrap items-center justify-center sm:justify-start gap-0.5"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const active = n <= display;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? null : n)}
            onMouseEnter={() => setHovered(n)}
            className={`${starSize} flex items-center justify-center transition-transform hover:scale-110 focus:outline-none`}
            aria-label={`Rate ${n} out of 10`}
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
      {value > 0 && (
        <span className="ml-1.5 text-sm font-semibold text-yellow-400 tabular-nums">
          {value}/10
        </span>
      )}
    </div>
  );
}

function groupListens(history) {
  const map = {};

  (history || []).forEach((item) => {
    const album = item.albums;
    if (!album?.spotify_id) return;

    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    const key = `${day}_${album.spotify_id}`;

    if (!map[key]) {
      map[key] = {
        key,
        day,
        count: 0,
        rating: null,
        review: null,
        listened_at: item.listened_at,
        listenId: item.id,
        album: {
          id: album.spotify_id,
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
        },
      };
    }

    map[key].count += 1;

    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at >= map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
      map[key].listenId = item.id;
      if (item.rating != null) map[key].rating = item.rating;
      if (item.review) map[key].review = item.review;
    } else {
      if (item.rating != null && map[key].rating == null) {
        map[key].rating = item.rating;
      }
      if (item.review && !map[key].review) map[key].review = item.review;
    }
  });

  return Object.values(map).sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day);
    return (b.listened_at || "").localeCompare(a.listened_at || "");
  });
}

function filterByPeriod(history, period) {
  if (!period || period === "all") return history;
  const now = new Date();
  const start =
    period === "year"
      ? new Date(now.getFullYear(), 0, 1)
      : period === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : null;
  if (!start) return history;
  return history.filter((item) => {
    if (!item.listened_at) return false;
    return new Date(item.listened_at) >= start;
  });
}

function groupByDay(entries) {
  const groups = {};
  entries.forEach((e) => {
    if (!groups[e.day]) groups[e.day] = [];
    groups[e.day].push(e);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function EditLogModal({ entry, onClose, onSaved }) {
  const [date, setDate] = useState(toDateInputValue(entry.listened_at));
  const [rating, setRating] = useState(
    entry.rating != null ? Number(entry.rating) : null
  );
  const [review, setReview] = useState(entry.review || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!entry.listenId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateListen(entry.listenId, {
        listened_at: date,
        rating: rating == null ? null : Number(rating),
        review: review.trim() || null,
      });
      onSaved?.(res.data, entry);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 sm:bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close"
      />

      {/* Sheet on mobile, centered card on desktop */}
      <div
        className="
          relative w-full sm:max-w-md
          bg-[#131e2c] border border-[#2a3645]
          rounded-t-2xl sm:rounded-2xl shadow-2xl
          max-h-[min(88vh,720px)] overflow-y-auto
          pb-[env(safe-area-inset-bottom,0px)]
        "
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#2a3645]" />
        </div>

        <div className="px-4 pt-2 pb-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-white text-center mb-4">
            Edit log
          </h2>

          <Link
            href={`/album/${entry.album.id}`}
            className="flex flex-col items-center text-center mb-5 group"
            onClick={onClose}
          >
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#0a121c] border border-[#2a3645] shadow-lg">
              {entry.album.cover_url ? (
                <Image
                  src={entry.album.cover_url}
                  alt=""
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">
                  —
                </div>
              )}
            </div>
            <p className="mt-2.5 text-sm font-semibold text-white group-hover:text-[#7cc7e8] transition-colors line-clamp-2 px-2">
              {entry.album.title}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">{entry.album.artist}</p>
          </Link>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">
                Listened on
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-2 text-center sm:text-left">
                Rating
              </label>
              <StarRating value={rating} onChange={setRating} size="sm" />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1.5">
                Review
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
                placeholder="Optional notes..."
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] resize-y min-h-[80px]"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 text-sm py-2.5 rounded-lg border border-[#2a3645] text-stone-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function DiaryView({
  history,
  period = "all",
  onPeriodChange,
  hasMore,
  loadingMore,
  onLoadMore,
  isOwner = false,
  onHistoryPatch,
}) {
  // Local copy so Save updates UI without full reload
  const [items, setItems] = useState(history || []);
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setItems(history || []);
  }, [history]);

  const processed = useMemo(() => {
    let list = filterByPeriod(items, period);
    let grouped = groupListens(list);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      grouped = grouped.filter(
        (e) =>
          e.album.title?.toLowerCase().includes(q) ||
          e.album.artist?.toLowerCase().includes(q)
      );
    }

    if (ratingFilter !== "all") {
      const r = Number(ratingFilter);
      grouped = grouped.filter((e) => e.rating === r);
    }

    return groupByDay(grouped);
  }, [items, period, query, ratingFilter]);

  const entryCount = processed.reduce((acc, [, items]) => acc + items.length, 0);

  const applyPatch = (updated) => {
    if (!updated?.id) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              listened_at: updated.listened_at ?? item.listened_at,
              rating:
                updated.rating !== undefined ? updated.rating : item.rating,
              review:
                updated.review !== undefined ? updated.review : item.review,
              albums: updated.albums
                ? { ...item.albums, ...updated.albums }
                : item.albums,
            }
          : item
      )
    );
    onHistoryPatch?.(updated);
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 mb-6 sm:mb-8 w-full min-w-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: "all", label: "All" },
            { id: "year", label: "This year" },
            { id: "month", label: "This month" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange?.(p.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                period === p.id
                  ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/40 text-[#7cc7e8]"
                  : "bg-[#131e2c] border-[#2a3645] text-stone-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search album or artist..."
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
      </div>

      {entryCount === 0 ? (
        <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-8 sm:p-10 text-center">
          <p className="text-stone-400 text-sm font-medium">No entries found</p>
          <p className="text-stone-500 text-xs mt-1 px-2">
            {isOwner
              ? "Try another filter or log an album."
              : "This user has no listens in this period."}
          </p>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8 w-full min-w-0">
          {processed.map(([day, entries]) => (
            <section key={day} className="w-full min-w-0">
              <h2 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-3 pb-2 border-b border-[#2a3645]">
                {formatDate(day)}
              </h2>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-center gap-2 sm:gap-3 bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-2 sm:p-3 hover:border-[#3d5068] transition-colors w-full min-w-0"
                  >
                    <Link
                      href={`/album/${entry.album.id}`}
                      className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 group"
                    >
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
                        {entry.album.cover_url ? (
                          <Image
                            src={entry.album.cover_url}
                            alt={entry.album.title}
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
                        <p className="text-sm font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                          {entry.album.title}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          {entry.album.artist}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {entry.count > 1 && (
                        <span className="text-[10px] sm:text-xs font-bold text-[#7cc7e8] bg-[#0a121c] px-1.5 sm:px-2 py-0.5 rounded border border-[#2a3645]">
                          ×{entry.count}
                        </span>
                      )}
                      {entry.rating != null && (
                        <span className="text-yellow-400 text-xs sm:text-sm font-semibold whitespace-nowrap">
                          ★ {entry.rating}
                        </span>
                      )}
                      {isOwner && entry.listenId && (
                        <button
                          type="button"
                          onClick={() => setEditing(entry)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-[#7cc7e8] hover:bg-[#0a121c] transition-colors"
                          title="Edit log"
                          aria-label="Edit log"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-sm text-[#7cc7e8] hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {editing && (
        <EditLogModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={applyPatch}
        />
      )}
    </div>
  );
}
