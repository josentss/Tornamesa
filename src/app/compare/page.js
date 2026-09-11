"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner } from "@/components/shared";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

function CoverTile({ item, badge }) {
  return (
    <Link
      href={`/album/${item.album_id}`}
      className="group flex flex-col min-w-[112px] w-[112px] sm:w-auto sm:min-w-0"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden border border-[#2a3645] bg-[#131e2c] transition-all group-hover:border-[#7cc7e8]/50">
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
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1.5">
            <p className="text-[10px] font-semibold text-white text-center leading-tight">
              {badge}
            </p>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
        {item.title}
      </p>
      <p className="text-[10px] text-stone-500 truncate">{item.artist}</p>
    </Link>
  );
}

function HStrip({ children }) {
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none sm:hidden">
        {children}
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 gap-3">
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
          label: "Shared",
          count: result.stats?.common ?? 0,
        },
        {
          id: "gaps",
          label: "Gaps",
          count: result.both_rated?.length ?? 0,
        },
        {
          id: "you",
          label: "Only you",
          count: result.stats?.only_you ?? 0,
        },
        {
          id: "them",
          label: `@${result.them?.username || "them"}`,
          count: result.stats?.only_them ?? 0,
        },
      ]
    : [];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Compare
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Your month vs someone you follow.
        </p>

        {/* friends */}
        <section className="mt-7">
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
              {following.length > 6 && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="w-full mb-3 bg-[#0a121c] border border-[#2a3645] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
                />
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filtered.slice(0, 20).map((f) => {
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

        {/* period + action */}
        <section
          className={`mt-6 flex flex-wrap items-center gap-3 ${
            !withUser ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          <div className="relative" ref={calRef}>
            <button
              type="button"
              onClick={() => {
                setCalYear(year);
                setCalOpen((v) => !v);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2a3645] bg-[#131e2c]/60 px-3 py-2.5 text-sm font-semibold text-stone-200 hover:border-[#7cc7e8]/40 transition-colors"
            >
              <CalendarIcon className="w-4 h-4 text-[#7cc7e8]" />
              {MONTH_SHORT[month - 1]} {year}
            </button>

            {calOpen && (
              <div className="absolute left-0 top-full mt-2 z-30 w-[240px] rounded-xl border border-[#2a3645] bg-[#0f1720] shadow-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    className="text-stone-400 hover:text-white px-2 py-1 text-sm"
                    onClick={() => setCalYear((y) => y - 1)}
                  >
                    ‹
                  </button>
                  <span className="text-sm font-semibold tabular-nums">
                    {calYear}
                  </span>
                  <button
                    type="button"
                    className="text-stone-400 hover:text-white px-2 py-1 text-sm"
                    onClick={() => setCalYear((y) => y + 1)}
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_SHORT.map((label, i) => {
                    const m = i + 1;
                    const active = calYear === year && m === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setPeriod(calYear, m)}
                        className={`text-xs font-semibold py-2 rounded-lg transition-colors ${
                          active
                            ? "bg-[#7cc7e8] text-[#0a121c]"
                            : "text-stone-400 hover:bg-[#1f2b3a] hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
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
              ? "…"
              : selected
                ? `Compare · @${selected.username}`
                : "Compare"}
          </button>
        </section>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {/* resultado */}
        {result && (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-[#2a3645] bg-[#131e2c]/50 px-4 py-5 sm:px-6">
              <div className="flex items-center justify-center gap-3 sm:gap-5">
                <Avatar
                  src={user.avatar_url}
                  name={result.you?.username}
                  size={48}
                />
                <div className="text-center px-1">
                  <p className="text-3xl sm:text-4xl font-black text-[#7cc7e8] tabular-nums leading-none">
                    {result.stats?.affinity_percent ?? 0}%
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 mt-1">
                    {MONTH_SHORT[month - 1]} {year}
                  </p>
                </div>
                <Avatar
                  src={result.them?.avatar_url || selected?.avatar_url}
                  name={result.them?.username}
                  size={48}
                />
              </div>
              <p className="text-center text-[11px] text-stone-500 mt-3">
                <span className="text-stone-300 font-medium">
                  {result.stats?.common ?? 0}
                </span>{" "}
                shared · {result.stats?.you_albums ?? 0} yours ·{" "}
                {result.stats?.them_albums ?? 0} theirs
              </p>
            </div>

            {/* tabs */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-[#2a3645] pb-px">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-t-lg border-b-2 transition-colors ${
                    tab === t.id
                      ? "border-[#7cc7e8] text-[#7cc7e8]"
                      : "border-transparent text-stone-500 hover:text-stone-300"
                  }`}
                >
                  {t.label}
                  <span className="ml-1 tabular-nums opacity-70">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {tab === "shared" && (
              <div>
                {result.common?.length ? (
                  <HStrip>
                    {result.common.map((item) => (
                      <CoverTile
                        key={item.album_id}
                        item={item}
                        badge={
                          <>
                            ×{item.you_plays}
                            <span className="text-white/50"> / </span>×
                            {item.them_plays}
                            {(item.you_rating != null ||
                              item.them_rating != null) && (
                              <>
                                <br />
                                <span className="text-yellow-400">
                                  {item.you_rating != null
                                    ? `★${item.you_rating}`
                                    : "—"}
                                  /
                                  {item.them_rating != null
                                    ? `★${item.them_rating}`
                                    : "—"}
                                </span>
                              </>
                            )}
                          </>
                        }
                      />
                    ))}
                  </HStrip>
                ) : (
                  <p className="text-sm text-stone-600 py-4 text-center">
                    No albums in common this month.
                  </p>
                )}
              </div>
            )}

            {tab === "gaps" && (
              <div>
                {result.both_rated?.length ? (
                  <HStrip>
                    {result.both_rated.slice(0, 12).map((item) => (
                      <CoverTile
                        key={item.album_id}
                        item={item}
                        badge={
                          <span className="text-yellow-400">
                            ★{item.you_rating} vs ★{item.them_rating}
                          </span>
                        }
                      />
                    ))}
                  </HStrip>
                ) : (
                  <p className="text-sm text-stone-600 py-4 text-center">
                    No shared ratings yet.
                  </p>
                )}
              </div>
            )}

            {tab === "you" && (
              <div>
                {result.only_you?.length ? (
                  <HStrip>
                    {result.only_you.slice(0, 12).map((item) => (
                      <CoverTile
                        key={item.album_id}
                        item={item}
                        badge={
                          <span className="text-[#7cc7e8]">×{item.plays}</span>
                        }
                      />
                    ))}
                  </HStrip>
                ) : (
                  <p className="text-sm text-stone-600 py-4 text-center">
                    Nothing exclusive.
                  </p>
                )}
              </div>
            )}

            {tab === "them" && (
              <div>
                {result.only_them?.length ? (
                  <HStrip>
                    {result.only_them.slice(0, 12).map((item) => (
                      <CoverTile
                        key={item.album_id}
                        item={item}
                        badge={<span>×{item.plays}</span>}
                      />
                    ))}
                  </HStrip>
                ) : (
                  <p className="text-sm text-stone-600 py-4 text-center">
                    Nothing exclusive.
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
