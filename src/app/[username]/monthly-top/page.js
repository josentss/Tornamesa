"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function weekRangeLabel(week) {
  const start = (week - 1) * 7 + 1;
  const end = Math.min(week * 7, 31);
  return `Days ${start}–${end}`;
}

function MonthlyTopContent({ username: usernameProp }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const year = parseInt(searchParams.get("year") || now.getUTCFullYear(), 10);
  const month = parseInt(searchParams.get("month") || now.getUTCMonth() + 1, 10);
  const weekParam = searchParams.get("week");
  const week =
    weekParam != null && weekParam !== "" ? parseInt(weekParam, 10) : null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!usernameProp) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getMonthlyTop(usernameProp, {
          year,
          month,
          week: week ?? undefined,
          limit: 20,
        });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load monthly top");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [usernameProp, year, month, week]);

  const setPeriod = (next) => {
    const params = new URLSearchParams();
    params.set("year", String(next.year));
    params.set("month", String(next.month));
    if (next.week != null) params.set("week", String(next.week));
    router.push(`/${usernameProp}/monthly-top?${params.toString()}`);
  };

  const availableMonths = data?.availableMonths || [];

  const monthIndex = useMemo(() => {
    return availableMonths.findIndex(
      (m) => m.year === year && m.month === month
    );
  }, [availableMonths, year, month]);

  const goMonth = (dir) => {
    if (!availableMonths.length) {
      let m = month + dir;
      let y = year;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      if (m > 12) {
        m = 1;
        y += 1;
      }
      setPeriod({ year: y, month: m, week: null });
      return;
    }
    const idx = monthIndex >= 0 ? monthIndex + dir : 0;
    if (idx < 0 || idx >= availableMonths.length) return;
    const target = availableMonths[idx];
    setPeriod({ year: target.year, month: target.month, week: null });
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <LoadingSpinner message="Loading monthly top..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <ErrorMessage message={error} />
      </div>
    );
  }

  const albums = data?.albums || [];
  const weeksAvailable = data?.weeksAvailable || [];

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden">
      <Link
        href={`/${usernameProp}`}
        className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
      >
        ← @{usernameProp}
      </Link>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Monthly Top
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {data?.label}
            {data?.weekLabel ? ` · ${data.weekLabel}` : ""}
          </p>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="w-9 h-9 rounded-lg bg-[#1f2b3a] border border-[#2a3645] text-stone-300 hover:text-white hover:border-[#3d5068] flex items-center justify-center"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-white min-w-[7.5rem] text-center">
            {MONTH_NAMES[month - 1]?.slice(0, 3)} {year}
          </span>
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="w-9 h-9 rounded-lg bg-[#1f2b3a] border border-[#2a3645] text-stone-300 hover:text-white hover:border-[#3d5068] flex items-center justify-center"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 flex flex-wrap gap-4 sm:gap-6 text-sm">
        <div>
          <span className="text-white font-semibold">{data?.totalListens ?? 0}</span>{" "}
          <span className="text-stone-500 text-xs">listens</span>
        </div>
        <div>
          <span className="text-white font-semibold">{data?.uniqueAlbums ?? 0}</span>{" "}
          <span className="text-stone-500 text-xs">albums</span>
        </div>
      </div>

      {/* Period: Full month + weeks */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPeriod({ year, month, week: null })}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            week == null
              ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/50 text-[#7cc7e8]"
              : "bg-[#1f2b3a] border-[#2a3645] text-stone-400 hover:text-white"
          }`}
        >
          Full month
        </button>
        {weeksAvailable.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setPeriod({ year, month, week: w })}
            title={weekRangeLabel(w)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              week === w
                ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/50 text-[#7cc7e8]"
                : "bg-[#1f2b3a] border-[#2a3645] text-stone-400 hover:text-white"
            }`}
          >
            Week {w}
          </button>
        ))}
      </div>

      {/* Ranking */}
      <div className="mt-8 space-y-2 sm:space-y-3">
        {loading && (
          <p className="text-stone-500 text-sm text-center py-4">Updating...</p>
        )}

        {!loading && albums.length === 0 && (
          <div className="py-14 text-center bg-[#131e2c]/50 border border-[#2a3645] rounded-xl">
            <p className="text-stone-400 text-sm">No listens in this period</p>
          </div>
        )}

        {albums.map((item) => (
          <Link
            key={`${item.rank}-${item.albumId}`}
            href={`/album/${item.albumId}`}
            className="flex items-center gap-3 sm:gap-4 bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 sm:p-4 hover:border-[#3d5068] transition-colors group"
          >
            <span
              className={`w-8 flex-shrink-0 text-center font-bold tabular-nums ${
                item.rank === 1
                  ? "text-[#7cc7e8] text-lg"
                  : item.rank <= 3
                  ? "text-white text-base"
                  : "text-stone-500 text-sm"
              }`}
            >
              {item.rank}
            </span>

            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0 relative">
              {item.cover && (
                <Image
                  src={item.cover}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                {item.title}
              </p>
              <p className="text-xs text-stone-500 truncate">{item.artist}</p>
            </div>

            <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
              <span className="text-xs font-bold text-[#7cc7e8]">
                ×{item.count}
              </span>
              {item.rating != null && (
                <span className="text-[10px] text-yellow-400">
                  ★ {Number(item.rating).toFixed(1)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Placeholder for Wrapped */}
      {user && data && (
        <div className="mt-10 pt-6 border-t border-[#2a3645] text-center">
          <p className="text-xs text-stone-500">
            Wrapped for this month — coming soon
          </p>
        </div>
      )}
    </main>
  );
}

function MonthlyTopPageInner({ params }) {
  const raw = typeof params?.then === "function" ? null : params?.username;
  const [username, setUsername] = useState(raw);

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setUsername(p.username));
    } else if (params?.username) {
      setUsername(params.username);
    }
  }, [params]);

  const { user } = useAuth();

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
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-20">
            <LoadingSpinner message="Loading monthly top..." />
          </div>
        }
      >
        <MonthlyTopContent username={username} />
      </Suspense>
      <Footer />
    </div>
  );
}

export default function MonthlyTopPage({ params }) {
  return <MonthlyTopPageInner params={params} />;
}
