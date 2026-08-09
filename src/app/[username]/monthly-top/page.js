"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ImportLogsModal from "@/components/monthly-top/ImportLogsModal";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function weekRangeLabel(week, month, year) {
  const start = (week - 1) * 7 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = Math.min(week * 7, lastDay);
  return `${MONTH_SHORT[month - 1]} ${start}–${end}`;
}

function CalendarIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M7 2h1a1 1 0 0 1 1 1v1h5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3V3a1 1 0 0 1 1-1m8 2h1V3h-1zM8 4V3H7v1zM6 5a2 2 0 0 0-2 2v1h15V7a2 2 0 0 0-2-2zM4 18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9H4zm8-5h5v5h-5zm1 1v3h3v-3z"
      />
    </svg>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function generateWrappedPng({
  username,
  label,
  weekLabel,
  totalListens,
  uniqueAlbums,
  albums,
}) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const list = (albums || []).slice(0, 5);
  const top = list[0];
  const topCover = top ? await loadImage(top.cover) : null;

  ctx.fillStyle = "#070b12";
  ctx.fillRect(0, 0, W, H);

  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, 500);
  g1.addColorStop(0, "rgba(124,199,232,0.22)");
  g1.addColorStop(1, "rgba(124,199,232,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * 0.85, H * 0.55, 0, W * 0.85, H * 0.55, 420);
  g2.addColorStop(0, "rgba(99,102,241,0.18)");
  g2.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  if (topCover) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.filter = "blur(40px)";
    const scale = Math.max(W / topCover.width, H / topCover.height) * 1.2;
    const bw = topCover.width * scale;
    const bh = topCover.height * scale;
    ctx.drawImage(topCover, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.fillStyle = "#7cc7e8";
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("TORNAMESA WRAPPED", 64, 100);

  ctx.fillStyle = "#f0f9ff";
  ctx.font = "800 64px system-ui, -apple-system, sans-serif";
  ctx.fillText(label || "", 64, 180);

  if (weekLabel) {
    ctx.fillStyle = "#7cc7e8";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(weekLabel, 64, 230);
  }

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(`@${username || ""}`, 64, weekLabel ? 280 : 240);

  const statsY = weekLabel ? 330 : 300;
  const chipW = 280;
  const chipH = 110;
  const gap = 24;
  [
    { value: String(totalListens ?? 0), label: "listens" },
    { value: String(uniqueAlbums ?? 0), label: "albums" },
  ].forEach((c, i) => {
    const x = 64 + i * (chipW + gap);
    ctx.fillStyle = "rgba(19,30,44,0.9)";
    roundRect(ctx, x, statsY, chipW, chipH, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(42,54,69,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#f0f9ff";
    ctx.font = "800 44px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.value, x + 28, statsY + 55);
    ctx.fillStyle = "#7cc7e8";
    ctx.font = "600 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(c.label, x + 28, statsY + 88);
  });

  let y = statsY + chipH + 56;

  if (top) {
    const heroSize = 420;
    const hx = (W - heroSize) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(124,199,232,0.45)";
    ctx.shadowBlur = 60;
    roundRect(ctx, hx, y, heroSize, heroSize, 28);
    ctx.fillStyle = "#131e2c";
    ctx.fill();
    ctx.restore();

    if (topCover) {
      ctx.save();
      roundRect(ctx, hx, y, heroSize, heroSize, 28);
      ctx.clip();
      ctx.drawImage(topCover, hx, y, heroSize, heroSize);
      ctx.restore();
    }

    ctx.fillStyle = "#7cc7e8";
    roundRect(ctx, hx + 20, y + 20, 72, 48, 12);
    ctx.fill();
    ctx.fillStyle = "#0a121c";
    ctx.font = "800 28px system-ui, -apple-system, sans-serif";
    ctx.fillText("#1", hx + 36, y + 52);

    y += heroSize + 36;

    ctx.textAlign = "center";
    ctx.fillStyle = "#f0f9ff";
    ctx.font = "800 44px system-ui, -apple-system, sans-serif";
    ctx.fillText(truncate(ctx, top.title || "", W - 120), W / 2, y);
    y += 42;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 28px system-ui, -apple-system, sans-serif";
    ctx.fillText(truncate(ctx, top.artist || "", W - 120), W / 2, y);
    y += 36;
    ctx.fillStyle = "#7cc7e8";
    ctx.font = "700 26px system-ui, -apple-system, sans-serif";
    ctx.fillText(`×${top.count ?? 0} plays`, W / 2, y);
    ctx.textAlign = "left";
    y += 56;
  }

  const rest = list.slice(1);
  if (rest.length > 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "700 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("ALSO IN THE MIX", 64, y);
    y += 28;

    const coverS = 140;
    const totalW = rest.length * coverS + (rest.length - 1) * 20;
    let cx = (W - totalW) / 2;

    for (let i = 0; i < rest.length; i++) {
      const item = rest[i];
      const img = await loadImage(item.cover);

      ctx.fillStyle = "#131e2c";
      roundRect(ctx, cx, y, coverS, coverS, 16);
      ctx.fill();

      if (img) {
        ctx.save();
        roundRect(ctx, cx, y, coverS, coverS, 16);
        ctx.clip();
        ctx.drawImage(img, cx, y, coverS, coverS);
        ctx.restore();
      }

      ctx.fillStyle = "rgba(10,18,28,0.85)";
      roundRect(ctx, cx + 8, y + 8, 36, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#7cc7e8";
      ctx.font = "700 16px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(item.rank ?? i + 2), cx + 16, y + 28);

      cx += coverS + 20;
    }

    y += coverS + 28;

    for (let i = 0; i < rest.length; i++) {
      const item = rest[i];
      ctx.fillStyle = "#64748b";
      ctx.font = "700 22px system-ui, -apple-system, sans-serif";
      ctx.fillText(`${item.rank}`, 64, y);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 24px system-ui, -apple-system, sans-serif";
      ctx.fillText(truncate(ctx, item.title || "", W - 220), 110, y);
      ctx.fillStyle = "#7cc7e8";
      ctx.textAlign = "right";
      ctx.font = "700 22px system-ui, -apple-system, sans-serif";
      ctx.fillText(`×${item.count ?? 0}`, W - 64, y);
      ctx.textAlign = "left";
      y += 40;
    }
  }

  ctx.strokeStyle = "#2a3645";
  ctx.beginPath();
  ctx.moveTo(64, H - 100);
  ctx.lineTo(W - 64, H - 100);
  ctx.stroke();

  ctx.fillStyle = "#7cc7e8";
  ctx.font = "800 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("Tornamesa", 64, H - 52);
  ctx.fillStyle = "#475569";
  ctx.font = "500 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(
    weekLabel ? "Your week in music" : "Your month in music",
    W - 64,
    H - 52
  );
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
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
  const [calendarYear, setCalendarYear] = useState(year);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [wrappedUrl, setWrappedUrl] = useState(null);
  const [wrappedLoading, setWrappedLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isOwner =
    !!user?.username &&
    user.username.toLowerCase() === (usernameProp || "").toLowerCase();

  useEffect(() => {
    setCalendarYear(year);
  }, [year]);

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
          limit: 500,
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
  }, [usernameProp, year, month, week, reloadKey]);

  const setPeriod = (next) => {
    const params = new URLSearchParams();
    params.set("year", String(next.year));
    params.set("month", String(next.month));
    if (next.week != null) params.set("week", String(next.week));
    router.push(`/${usernameProp}/monthly-top?${params.toString()}`);
  };

  const availableMonths = data?.availableMonths || [];

  const monthsWithData = useMemo(() => {
    return new Set(availableMonths.map((m) => `${m.year}-${m.month}`));
  }, [availableMonths]);

  const availableYears = useMemo(() => {
    const years = [...new Set(availableMonths.map((m) => m.year))];
    return years.sort((a, b) => b - a);
  }, [availableMonths]);

  const yearIndex = availableYears.indexOf(calendarYear);
  const canPrevYear =
    availableYears.length === 0 || yearIndex < availableYears.length - 1;
  const canNextYear = availableYears.length === 0 || yearIndex > 0;

  const goCalendarYear = (dir) => {
    if (availableYears.length === 0) {
      setCalendarYear((y) => y + dir);
      return;
    }
    const idx = yearIndex >= 0 ? yearIndex + dir : 0;
    if (idx < 0 || idx >= availableYears.length) return;
    setCalendarYear(availableYears[idx]);
  };

  const wrappedStats = useMemo(() => {
    if (!data) return { totalListens: 0, uniqueAlbums: 0 };
    if (week == null) {
      return {
        totalListens: data.totalListens ?? 0,
        uniqueAlbums: data.uniqueAlbums ?? 0,
      };
    }
    const list = data.albums || [];
    return {
      totalListens: list.reduce((s, a) => s + (a.count || 0), 0),
      uniqueAlbums: list.length,
    };
  }, [data, week]);

  const openWrapped = async () => {
    if (!data || !isOwner) return;
    setWrappedOpen(true);
    setWrappedLoading(true);
    setWrappedUrl(null);
    try {
      const url = await generateWrappedPng({
        username: usernameProp,
        label: data.label,
        weekLabel:
          week != null
            ? `Week ${week} · ${weekRangeLabel(week, month, year)}`
            : null,
        totalListens: wrappedStats.totalListens,
        uniqueAlbums: wrappedStats.uniqueAlbums,
        albums: data.albums || [],
      });
      setWrappedUrl(url);
    } catch (e) {
      console.error("Wrapped generate error:", e);
    } finally {
      setWrappedLoading(false);
    }
  };

  const downloadWrapped = () => {
    if (!wrappedUrl) return;
    const a = document.createElement("a");
    a.href = wrappedUrl;
    a.download =
      week != null
        ? `tornamesa-wrapped-${year}-${String(month).padStart(2, "0")}-w${week}.png`
        : `tornamesa-wrapped-${year}-${String(month).padStart(2, "0")}.png`;
    a.click();
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
  const subtitle =
    week != null
      ? `Week ${week} · ${weekRangeLabel(week, month, year)}`
      : data?.label || `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden">
      <Link
        href={`/${usernameProp}`}
        className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
      >
        ← @{usernameProp}
      </Link>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Monthly Top
          </h1>
          <p className="text-stone-400 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-start">
          {isOwner && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-[#2a3645] bg-[#1f2b3a] text-[#7cc7e8] hover:border-[#7cc7e8]/40 transition-colors"
            >
              Import logs
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setArchiveOpen((o) => !o)}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] text-stone-300 hover:text-white hover:border-[#3d5068] transition-colors"
              aria-expanded={archiveOpen}
            >
              <CalendarIcon className="w-4 h-4 text-[#7cc7e8]" />
              <span>
                {MONTH_SHORT[month - 1]} {year}
              </span>
              <span className="text-stone-500 text-[10px]">
                {archiveOpen ? "▲" : "▼"}
              </span>
            </button>

            {archiveOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setArchiveOpen(false)}
                />
                <div className="absolute left-0 sm:left-auto sm:right-0 z-20 mt-2 w-[min(100vw-2rem,18rem)] bg-[#131e2c] border border-[#2a3645] rounded-xl p-3 sm:p-4 shadow-xl">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => goCalendarYear(1)}
                      disabled={!canPrevYear && availableYears.length > 0}
                      className="w-8 h-8 rounded-lg bg-[#1f2b3a] border border-[#2a3645] text-stone-300 hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                    >
                      ‹
                    </button>
                    <span className="text-sm font-bold text-white">
                      {calendarYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => goCalendarYear(-1)}
                      disabled={!canNextYear && availableYears.length > 0}
                      className="w-8 h-8 rounded-lg bg-[#1f2b3a] border border-[#2a3645] text-stone-300 hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const hasData = monthsWithData.has(`${calendarYear}-${m}`);
                      const isSelected = calendarYear === year && m === month;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={!hasData}
                          onClick={() => {
                            if (!hasData) return;
                            setPeriod({
                              year: calendarYear,
                              month: m,
                              week: null,
                            });
                            setArchiveOpen(false);
                          }}
                          className={`min-w-0 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            isSelected
                              ? "bg-[#7cc7e8]/15 border-[#7cc7e8]/50 text-[#7cc7e8]"
                              : hasData
                              ? "bg-[#1f2b3a] border-[#2a3645] text-stone-200 hover:border-[#3d5068] hover:text-white"
                              : "bg-transparent border-transparent text-stone-600 opacity-40 cursor-not-allowed"
                          }`}
                        >
                          {MONTH_SHORT[i]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 sm:gap-6 text-sm">
        <div>
          <span className="text-white font-semibold">
            {week == null
              ? data?.totalListens ?? 0
              : wrappedStats.totalListens}
          </span>{" "}
          <span className="text-stone-500 text-xs">listens</span>
        </div>
        <div>
          <span className="text-white font-semibold">
            {week == null
              ? data?.uniqueAlbums ?? 0
              : wrappedStats.uniqueAlbums}
          </span>{" "}
          <span className="text-stone-500 text-xs">albums</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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
            title={weekRangeLabel(w, month, year)}
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

      {week != null && (
        <p className="mt-2 text-[11px] text-stone-500">
          {weekRangeLabel(week, month, year)}
        </p>
      )}

      <div className="mt-8 space-y-2 sm:space-y-3">
        {loading && (
          <p className="text-stone-500 text-sm text-center py-4">Updating...</p>
        )}
        {!loading && albums.length === 0 && (
          <div className="py-14 text-center bg-[#131e2c]/50 border border-[#2a3645] rounded-xl">
            <p className="text-stone-400 text-sm">No listens in this period</p>
          </div>
        )}
        {albums.map((item) => {
          const isFirst = item.rank === 1;
          return (
            <Link
              key={`${item.rank}-${item.albumId}`}
              href={`/album/${item.albumId}`}
              className={`flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-4 transition-colors group min-w-0 ${
                isFirst
                  ? "bg-[#131e2c] border border-[#7cc7e8]/40 shadow-[0_0_24px_-8px_rgba(124,199,232,0.35)] sm:p-5"
                  : "bg-[#131e2c]/60 border border-[#2a3645] hover:border-[#3d5068]"
              }`}
            >
              <span
                className={`w-7 sm:w-8 flex-shrink-0 text-center font-bold tabular-nums ${
                  isFirst
                    ? "text-[#7cc7e8] text-lg sm:text-xl"
                    : item.rank <= 3
                    ? "text-white text-base"
                    : "text-stone-500 text-sm"
                }`}
              >
                {item.rank}
              </span>
              <div
                className={`rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0 relative ${
                  isFirst
                    ? "w-14 h-14 sm:w-16 sm:h-16"
                    : "w-11 h-11 sm:w-14 sm:h-14"
                }`}
              >
                {item.cover && (
                  <Image
                    src={item.cover}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes={isFirst ? "64px" : "56px"}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {isFirst && (
                  <p className="text-[10px] uppercase tracking-widest text-[#7cc7e8] font-bold mb-0.5">
                    #1 this period
                  </p>
                )}
                <p
                  className={`font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors ${
                    isFirst ? "text-sm sm:text-base" : "text-sm"
                  }`}
                >
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
          );
        })}
      </div>

      {isOwner &&
        data &&
        (wrappedStats.totalListens > 0 || albums.length > 0) && (
          <div className="mt-10 pt-6 border-t border-[#2a3645] flex justify-center">
            <button
              type="button"
              onClick={openWrapped}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] transition-colors"
            >
              {week != null
                ? `Generate Week ${week} Wrapped`
                : "Generate Wrapped"}
            </button>
          </div>
        )}

      {wrappedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setWrappedOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-[#131e2c] border border-[#2a3645] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3645]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {week != null
                  ? `Week ${week} · ${data?.label}`
                  : `${data?.label} Wrapped`}
              </h3>
              <button
                type="button"
                onClick={() => setWrappedOpen(false)}
                className="text-stone-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-3 sm:p-4 flex justify-center bg-[#0a0f16] min-h-[180px]">
              {wrappedLoading && (
                <p className="text-stone-500 text-sm py-16">Generating...</p>
              )}
              {!wrappedLoading && wrappedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wrappedUrl}
                  alt="Wrapped"
                  className="w-full max-w-[280px] sm:max-w-xs rounded-lg border border-[#2a3645]"
                />
              )}
              {!wrappedLoading && !wrappedUrl && (
                <p className="text-stone-500 text-sm py-16">
                  Could not generate image
                </p>
              )}
            </div>

            <div className="p-4 border-t border-[#2a3645] flex gap-2">
              <button
                type="button"
                onClick={downloadWrapped}
                disabled={!wrappedUrl}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-40"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => setWrappedOpen(false)}
                className="px-4 text-sm text-stone-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && (
        <ImportLogsModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setReloadKey((k) => k + 1);
          }}
        />
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
