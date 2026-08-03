"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
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

/**
 * Agrupa listens por día + álbum.
 * Si el mismo disco se logueó varias veces el mismo día → una sola entrada con count.
 */
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

    // Nos quedamos con el rating más reciente no nulo
    if (item.rating != null) {
      map[key].rating = item.rating;
    }

    // Mantener la fecha/hora más reciente del grupo
    if (
      item.listened_at &&
      (!map[key].listened_at ||
        item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });

  // Orden: por día desc, y dentro del día por listened_at desc
  return Object.values(map).sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day);
    return (b.listened_at || "").localeCompare(a.listened_at || "");
  });
}

function groupByDay(entries) {
  const groups = {};
  entries.forEach((entry) => {
    if (!groups[entry.day]) groups[entry.day] = [];
    groups[entry.day].push(entry);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function DiaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 40;

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
        console.error(err);
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

  const groupedEntries = useMemo(() => groupListens(history), [history]);
  const byDay = useMemo(() => groupByDay(groupedEntries), [groupedEntries]);

  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading diary..." />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Diary</h1>
          <p className="text-stone-400 text-sm mt-1">
            Your listening history — same album on the same day is grouped
          </p>
          {groupedEntries.length > 0 && (
            <p className="text-stone-500 text-xs mt-2">
              {groupedEntries.length} entr
              {groupedEntries.length === 1 ? "y" : "ies"}
              {history.length !== groupedEntries.length && (
                <span> · {history.length} total logs</span>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        {!error && groupedEntries.length === 0 && (
          <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-10 text-center">
            <p className="text-stone-400 text-sm font-medium">No listens yet</p>
            <p className="text-stone-500 text-xs mt-1 max-w-xs mx-auto">
              Search for an album and hit “Log listen” or “Rate & review”.
            </p>
            <Link
              href="/search"
              className="inline-block mt-4 text-sm text-[#7cc7e8] hover:underline"
            >
              Go to search
            </Link>
          </div>
        )}

        <div className="space-y-8">
          {byDay.map(([day, entries]) => (
            <section key={day}>
              <h2 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-3 pb-2 border-b border-[#2a3645]">
                {formatDate(day)}
              </h2>
              <div className="space-y-2">
                {entries.map((entry) => (
                  <Link
                    key={entry.key}
                    href={`/album/${entry.album.id}`}
                    className="flex items-center gap-3 sm:gap-4 bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 hover:border-[#3d5068] transition-colors group"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
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

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                        {entry.album.title}
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        {entry.album.artist}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {entry.count > 1 && (
                        <span className="text-xs font-bold text-[#7cc7e8] bg-[#0a121c] px-2 py-0.5 rounded border border-[#2a3645]">
                          ×{entry.count}
                        </span>
                      )}
                      {entry.rating != null && (
                        <span className="text-yellow-400 text-sm font-semibold">
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

        {hasMore && groupedEntries.length > 0 && (
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
      </main>

      <Footer />
    </div>
  );
}
