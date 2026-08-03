"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(history) {
  const groups = {};
  (history || []).forEach((item) => {
    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    if (!groups[day]) groups[day] = [];
    groups[day].push(item);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function DiaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 30;

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
        setHistory(data.history || []);
        setStats(data.stats || null);
        setOffset(limit);
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
    if (!user || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getUserHistory(user.id, limit, offset);
      const more = data.history || [];
      setHistory((prev) => [...prev, ...more]);
      setOffset((prev) => prev + limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

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

  const grouped = groupByDate(history);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Diary</h1>
          <p className="text-stone-400 text-sm mt-1">
            Your listening history
          </p>

          {stats && (
            <div className="flex gap-6 mt-5 text-sm">
              <div>
                <span className="text-white font-semibold">
                  {stats.totalAlbumsListened ?? history.length}
                </span>{" "}
                <span className="text-stone-500">in this page load</span>
              </div>
              {stats.totalMinutesSpended > 0 && (
                <div>
                  <span className="text-white font-semibold">
                    {stats.totalMinutesSpended}
                  </span>{" "}
                  <span className="text-stone-500">min</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        {!error && history.length === 0 && (
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
          {grouped.map(([day, items]) => (
            <section key={day}>
              <h2 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-3 pb-2 border-b border-[#2a3645]">
                {formatDate(day)}
              </h2>
              <div className="space-y-2">
                {items.map((item) => {
                  const album = item.albums;
                  const albumId = album?.spotify_id;
                  if (!album || !albumId) return null;

                  return (
                    <Link
                      key={item.id}
                      href={`/album/${albumId}`}
                      className="flex items-center gap-3 sm:gap-4 bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 hover:border-[#3d5068] transition-colors group"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
                        {album.cover_url ? (
                          <Image
                            src={album.cover_url}
                            alt={album.title}
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
                          {album.title}
                        </p>
                        <p className="text-xs text-stone-400 truncate">
                          {album.artist}
                        </p>
                      </div>
                      {item.rating != null && (
                        <span className="text-yellow-400 text-sm font-semibold flex-shrink-0">
                          ★ {item.rating}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {history.length >= offset && history.length > 0 && (
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
