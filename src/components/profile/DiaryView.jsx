"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
        listened_at: item.listened_at,
        album: {
          id: album.spotify_id,
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
        },
      };
    }

    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
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

export default function DiaryView({
  history,
  period = "all",
  onPeriodChange,
  hasMore,
  loadingMore,
  onLoadMore,
  isOwner = false,
}) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  const processed = useMemo(() => {
    let list = filterByPeriod(history, period);
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
  }, [history, period, query, ratingFilter]);

  const entryCount = processed.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className="w-full min-w-0">
      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 sm:mb-8 w-full min-w-0">
        {/* Period chips – scroll horizontal en móvil si hace falta */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0 scrollbar-hide">
          {[
            { id: "all", label: "All" },
            { id: "year", label: "This year" },
            { id: "month", label: "This month" },
          ].map((p) => (
            <button
              key={p.id}
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

        {/* Search + rating – apilados en móvil */}
        <div className="flex flex-col xs:flex-row sm:flex-row gap-2 w-full min-w-0">
          <input
            type="search"
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
                  <Link
                    key={entry.key}
                    href={`/album/${entry.album.id}`}
                    className="flex items-center gap-3 bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-2.5 sm:p-3 hover:border-[#3d5068] transition-colors group w-full min-w-0"
                  >
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
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

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
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
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-sm text-[#7cc7e8] hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
