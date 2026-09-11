"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner } from "@/components/shared";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function CalendarIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M7 2h1a1 1 0 0 1 1 1v1h5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3V3a1 1 0 0 1 1-1m8 2h1V3h-1zM8 4V3H7v1zM6 5a2 2 0 0 0-2 2v1h15V7a2 2 0 0 0-2-2zM4 18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9H4zm8-5h5v5h-5zm1 1v3h3v-3z"
      />
    </svg>
  );
}

function normalizeFollowing(list) {
  return (list || [])
    .map((f) => {
      const p = f.profiles || f.user || f;
      const username = p.username || f.username || "";
      if (!username) return null;
      return {
        username,
        full_name: p.full_name || f.full_name || null,
        avatar_url: p.avatar_url || f.avatar_url || null,
      };
    })
    .filter(Boolean);
}

function Avatar({ src, name, size = 40 }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className="relative rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center text-[#7cc7e8] font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </div>
  );
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

async function generateComparePng(result) {
  const W = 900;
  const H = 900;
  const PAD = 40;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a121c";
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(124,199,232,0.10)");
  grad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const main = "#f5f0e6";
  const muted = "rgba(245,240,230,0.55)";
  const accent = "#7cc7e8";

  ctx.fillStyle = accent;
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText("TORNAMESA COMPARE", PAD, 48);

  ctx.fillStyle = main;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText(
    `@${result.you?.username || "you"}  ·  @${result.them?.username || ""}`,
    PAD,
    100
  );

  ctx.fillStyle = muted;
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText(result.period?.label || "", PAD, 132);

  ctx.fillStyle = accent;
  ctx.font = "900 88px system-ui, sans-serif";
  ctx.fillText(`${result.stats?.affinity_percent ?? 0}%`, PAD, 240);

  ctx.fillStyle = muted;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillText("monthly taste match", PAD, 272);

  ctx.fillStyle = main;
  ctx.font = "600 17px system-ui, sans-serif";
  ctx.fillText(
    `${result.stats?.common ?? 0} albums · ${result.stats?.common_artists ?? 0} artists shared`,
    PAD,
    318
  );
  ctx.fillStyle = muted;
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillText(
    `Albums ${result.stats?.affinity_albums ?? 0}%  ·  Artists ${result.stats?.affinity_artists ?? 0}%`,
    PAD,
    344
  );

  const covers = (result.common || []).slice(0, 4);
  const imgs = await Promise.all(covers.map((c) => loadImage(c.cover)));
  const size = 150;
  const gap = 14;
  const rowW = covers.length * size + Math.max(0, covers.length - 1) * gap;
  let x = covers.length ? (W - rowW) / 2 : PAD;
  const y = 400;

  ctx.fillStyle = muted;
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText("TOP MATCHES", PAD, y - 20);

  for (let i = 0; i < covers.length; i++) {
    const img = imgs[i];
    roundRect(ctx, x, y, size, size, 14);
    ctx.save();
    ctx.clip();
    if (img) ctx.drawImage(img, x, y, size, size);
    else {
      ctx.fillStyle = "#1f2b3a";
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
    ctx.fillStyle = main;
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText((covers[i].title || "").slice(0, 16), x, y + size + 24);
    ctx.fillStyle = muted;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(
      `×${covers[i].you_plays} / ×${covers[i].them_plays}`,
      x,
      y + size + 44
    );
    x += size + gap;
  }

  ctx.fillStyle = muted;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("tornamesa.app", W / 2, H - 32);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

function CoverTile({ item, badge }) {
  return (
    <Link
      href={`/album/${item.album_id}`}
      className="group flex flex-col min-w-[96px] w-[96px] sm:min-w-0 sm:w-auto"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden border border-[#2a3645] bg-[#131e2c] transition-all group-hover:border-[#7cc7e8]/50">
        {item.cover ? (
          <Image
            src={item.cover}
            alt=""
            fill
            sizes="120px"
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[#1f2b3a]" />
        )}
        {badge && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pt-4 pb-1.5">
            <p className="text-[10px] font-semibold text-white text-center leading-tight">
              {badge}
            </p>
          </div>
        )}
      </div>
      <p className="mt-1 text-[10px] sm:text-[11px] font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
        {item.title}
      </p>
      <p className="text-[9px] sm:text-[10px] text-stone-500 truncate">
        {item.artist}
      </p>
    </Link>
  );
}

function TileGrid({ children }) {
  return (
    <>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none md:hidden">
        {children}
      </div>
      <div className="hidden md:grid md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {children}
      </div>
    </>
  );
}

export default function ComparePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [following, setFollowing] = useState([]);
  const [query, setQuery] = useState("");
  const [withUser, setWithUser] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [tab, setTab] = useState("shared");
  const [monthsWithData, setMonthsWithData] = useState(() => new Set());
  const [shareBusy, setShareBusy] = useState(false);
  const calRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.username) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const res = await api.getFollowing(user.username, null, 100, 0);
        const list = Array.isArray(res)
          ? res
          : res?.users || res?.following || [];
        if (!cancelled) setFollowing(normalizeFollowing(list));
      } catch {
        if (!cancelled) setFollowing([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  useEffect(() => {
    if (!user?.username || !withUser) {
      setMonthsWithData(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const [a, b] = await Promise.all([
          api
            .getMonthlyTop(user.username, { year: y, month: m })
            .catch(() => null),
          api.getMonthlyTop(withUser, { year: y, month: m }).catch(() => null),
        ]);
        const set = new Set();
        [...(a?.availableMonths || []), ...(b?.availableMonths || [])].forEach(
          (x) => {
            if (x?.year && x?.month) set.add(`${x.year}-${x.month}`);
          }
        );
        if (!cancelled) {
          setMonthsWithData(set);
          const years = [...set].map((k) => Number(k.split("-")[0]));
          if (years.length) setCalYear(Math.max(...years));
        }
      } catch {
        if (!cancelled) setMonthsWithData(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.username, withUser]);

  useEffect(() => {
    if (!calOpen) return;
    const onDoc = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) {
        setCalOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [calOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return following;
    return following.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        (f.full_name || "").toLowerCase().includes(q)
    );
  }, [following, query]);

  const selected = following.find((f) => f.username === withUser) || null;

  const availableYears = useMemo(() => {
    const ys = [
      ...new Set([...monthsWithData].map((k) => Number(k.split("-")[0]))),
    ].sort((a, b) => b - a);
    return ys.length ? ys : [now.getFullYear()];
  }, [monthsWithData, now]);

  const pickFriend = (username) => {
    setWithUser(username === withUser ? "" : username);
    setResult(null);
    setError("");
    setTab("shared");
  };

  const setPeriod = (y, m) => {
    setYear(y);
    setMonth(m);
    setCalOpen(false);
    setResult(null);
  };

  const runCompare = async () => {
    if (!user?.id || !withUser || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setTab("shared");
    try {
      const data = await api.compareMonth(user.id, {
        with: withUser,
        year,
        month,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "Compare failed");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (!result || shareBusy) return;
    setShareBusy(true);
    try {
      const dataUrl = await generateComparePng(result);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `tornamesa-compare-${result.them?.username || "friend"}.png`,
        { type: "image/png" }
      );

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Tornamesa Compare",
          text: `${result.stats?.affinity_percent ?? 0}% taste match with @${result.them?.username} · ${result.period?.label}`,
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setShareBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  const tabs = result
    ? [
        {
          id: "shared",
          label: "Matches",
          count: result.stats?.common ?? 0,
          items: result.common || [],
          badge: (item) => (
            <>
              ×{item.you_plays}
              <span className="text-white/50"> / </span>×{item.them_plays}
            </>
          ),
        },
        {
          id: "gaps",
          label: "We disagree",
          count: result.both_rated?.length ?? 0,
          items: result.both_rated || [],
          badge: (item) => (
            <span className="text-yellow-400">
              ★{item.you_rating} vs ★{item.them_rating}
            </span>
          ),
        },
        {
          id: "you",
          label: "Just you",
          count: result.stats?.only_you ?? 0,
          items: result.only_you || [],
          badge: (item) => (
            <span className="text-[#7cc7e8]">×{item.plays}</span>
          ),
        },
        {
          id: "them",
          label: "Just them",
          count: result.stats?.only_them ?? 0,
          items: result.only_them || [],
          badge: (item) => <span>×{item.plays}</span>,
        },
      ]
    : [];

  const activeTab = tabs.find((t) => t.id === tab) || tabs[0];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Compare
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            See how your month of albums lines up with a friend.
          </p>
        </div>

        <section className="mt-8">
          {listLoading ? (
            <p className="text-sm text-stone-500 py-6 text-center">
              Loading friends…
            </p>
          ) : following.length === 0 ? (
            <div className="rounded-2xl border border-[#2a3645] bg-[#131e2c]/40 px-4 py-8 text-center">
              <p className="text-sm text-stone-400">
                Follow people first to compare months.
              </p>
              <Link
                href="/discover"
                className="inline-block mt-3 text-sm text-[#7cc7e8] hover:underline"
              >
                Discover
              </Link>
            </div>
          ) : (
            <>
              {following.length > 8 && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter friends…"
                  className="w-full max-w-md mb-3 bg-[#0a121c] border border-[#2a3645] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
                />
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {filtered.slice(0, 24).map((f) => {
                  const active = withUser === f.username;
                  return (
                    <button
                      key={f.username}
                      type="button"
                      onClick={() => pickFriend(f.username)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-all ${
                        active
                          ? "border-[#7cc7e8] bg-[#7cc7e8]/10"
                          : "border-[#2a3645] bg-[#131e2c]/35 hover:border-[#3d5068]"
                      }`}
                    >
                      <Avatar
                        src={f.avatar_url}
                        name={f.username}
                        size={44}
                      />
                      <span
                        className={`text-[10px] sm:text-[11px] font-medium truncate w-full text-center ${
                          active ? "text-[#7cc7e8]" : "text-stone-400"
                        }`}
                      >
                        @{f.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section
          className={`mt-6 flex flex-wrap items-center gap-3 ${
            !withUser ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          <div className="relative" ref={calRef}>
            <button
              type="button"
              onClick={() => {
                setCalYear(
                  availableYears.includes(year)
                    ? year
                    : availableYears[0] || year
                );
                setCalOpen((v) => !v);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2a3645] bg-[#131e2c]/60 px-3 py-2.5 text-sm font-semibold text-stone-200 hover:border-[#7cc7e8]/40 transition-colors"
            >
              <CalendarIcon className="w-4 h-4 text-[#7cc7e8]" />
              {MONTH_SHORT[month - 1]} {year}
            </button>

            {calOpen && (
              <div className="absolute left-0 top-full mt-2 z-30 w-[260px] rounded-xl border border-[#2a3645] bg-[#0f1720] shadow-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    className="text-stone-400 hover:text-white px-2 py-1 text-sm disabled:opacity-30"
                    disabled={
                      availableYears.length === 0 ||
                      calYear <= Math.min(...availableYears)
                    }
                    onClick={() => {
                      const idx = availableYears.indexOf(calYear);
                      if (idx < availableYears.length - 1) {
                        setCalYear(availableYears[idx + 1]);
                      } else {
                        setCalYear((y) => y - 1);
                      }
                    }}
                  >
                    ‹
                  </button>
                  <span className="text-sm font-semibold tabular-nums">
                    {calYear}
                  </span>
                  <button
                    type="button"
                    className="text-stone-400 hover:text-white px-2 py-1 text-sm disabled:opacity-30"
                    disabled={
                      availableYears.length === 0 ||
                      calYear >= Math.max(...availableYears)
                    }
                    onClick={() => {
                      const idx = availableYears.indexOf(calYear);
                      if (idx > 0) setCalYear(availableYears[idx - 1]);
                      else setCalYear((y) => y + 1);
                    }}
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_SHORT.map((label, i) => {
                    const m = i + 1;
                    const key = `${calYear}-${m}`;
                    const hasData =
                      monthsWithData.size === 0 || monthsWithData.has(key);
                    const active = calYear === year && m === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={!hasData}
                        onClick={() => hasData && setPeriod(calYear, m)}
                        className={`text-xs font-semibold py-2 rounded-lg transition-colors ${
                          active
                            ? "bg-[#7cc7e8] text-[#0a121c]"
                            : hasData
                              ? "text-stone-300 hover:bg-[#1f2b3a] hover:text-white"
                              : "text-stone-700 cursor-not-allowed"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {monthsWithData.size > 0 && (
                  <p className="text-[10px] text-stone-600 mt-2 text-center">
                    Months with listens are available
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={runCompare}
            disabled={!withUser || busy}
            className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-35 transition-colors"
          >
            {busy
              ? "Comparing…"
              : selected
                ? `Compare · @${selected.username}`
                : "Compare"}
          </button>
        </section>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {result && (
          <div className="mt-10 space-y-6">
            <div className="rounded-2xl border border-[#2a3645] bg-[#131e2c]/50 px-4 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <Avatar
                      src={user.avatar_url}
                      name={result.you?.username}
                      size={52}
                    />
                    <span className="text-[11px] text-stone-400">
                      @{result.you?.username}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl sm:text-5xl font-black text-[#7cc7e8] tabular-nums leading-none">
                      {result.stats?.affinity_percent ?? 0}%
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-stone-500 mt-1.5">
                      {MONTH_SHORT[month - 1]} {year}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Avatar
                      src={result.them?.avatar_url || selected?.avatar_url}
                      name={result.them?.username}
                      size={52}
                    />
                    <Link
                      href={`/${result.them?.username}`}
                      className="text-[11px] text-[#7cc7e8] hover:underline"
                    >
                      @{result.them?.username}
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end gap-1.5">
                  <p className="text-sm text-stone-300 text-center sm:text-right">
                    <span className="text-white font-semibold">
                      {result.stats?.common ?? 0}
                    </span>{" "}
                    albums in common
                    {result.stats?.common_artists != null && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="text-white font-semibold">
                          {result.stats.common_artists}
                        </span>{" "}
                        artists overlap
                      </>
                    )}
                  </p>
                  {(result.stats?.affinity_albums != null ||
                    result.stats?.affinity_artists != null) && (
                    <p className="text-[11px] text-stone-500 text-center sm:text-right">
                      Taste mix: {result.stats?.affinity_albums ?? "—"}% albums
                      · {result.stats?.affinity_artists ?? "—"}% artists
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={shareBusy}
                    className="mt-1 text-xs font-semibold px-3.5 py-2 rounded-lg border border-[#2a3645] bg-[#0a121c] text-stone-200 hover:border-[#7cc7e8]/40 disabled:opacity-40 transition-colors"
                  >
                    {shareBusy ? "Preparing…" : "Share result"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-[#2a3645]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-shrink-0 text-xs font-semibold px-3.5 py-2.5 border-b-2 transition-colors ${
                    tab === t.id
                      ? "border-[#7cc7e8] text-[#7cc7e8]"
                      : "border-transparent text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 tabular-nums text-stone-600">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {activeTab && (
              <div>
                {activeTab.items.length ? (
                  <TileGrid>
                    {activeTab.items.map((item) => (
                      <CoverTile
                        key={item.album_id}
                        item={item}
                        badge={activeTab.badge(item)}
                      />
                    ))}
                  </TileGrid>
                ) : (
                  <p className="text-sm text-stone-600 py-8 text-center">
                    Nothing here for this month.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
