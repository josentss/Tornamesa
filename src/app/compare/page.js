"use client";

import { useState, useEffect, useMemo } from "react";
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

function AlbumRow({ item, right }) {
  return (
    <Link
      href={`/album/${item.album_id}`}
      className="flex items-center gap-3 rounded-xl border border-[#2a3645] bg-[#0a121c]/70 px-2.5 py-2 hover:border-[#7cc7e8]/40 transition-colors group min-w-0"
    >
      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0">
        {item.cover ? (
          <Image
            src={item.cover}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
          {item.title}
        </p>
        <p className="text-[11px] text-stone-500 truncate">{item.artist}</p>
      </div>
      <div className="flex-shrink-0 text-right text-[11px] text-stone-400">
        {right}
      </div>
    </Link>
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
  const [showAllCommon, setShowAllCommon] = useState(false);

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
    setShowAllCommon(false);
  };

  const runCompare = async () => {
    if (!user?.id || !withUser || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setShowAllCommon(false);
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

  const commonPreview = showAllCommon
    ? result?.common || []
    : (result?.common || []).slice(0, 6);

  const periodChips = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodChips.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Compare
          </h1>
          <p className="text-sm text-stone-500 mt-1.5 max-w-md">
            Pick someone you follow and see how your month of albums lines up.
          </p>
        </div>

        {/* select friend */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
              1 · Who
            </h2>
            {selected && (
              <button
                type="button"
                onClick={() => pickFriend(selected.username)}
                className="text-[11px] text-stone-500 hover:text-stone-300"
              >
                Clear
              </button>
            )}
          </div>

          {listLoading ? (
            <p className="text-sm text-stone-500 py-6 text-center">
              Loading friends…
            </p>
          ) : following.length === 0 ? (
            <div className="rounded-2xl border border-[#2a3645] bg-[#131e2c]/40 px-4 py-8 text-center">
              <p className="text-sm text-stone-400">
                Follow a few people first to compare months.
              </p>
              <Link
                href="/discover"
                className="inline-block mt-3 text-sm text-[#7cc7e8] hover:underline"
              >
                Discover people
              </Link>
            </div>
          ) : (
            <>
              {following.length > 6 && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter friends…"
                  className="w-full mb-3 bg-[#0a121c] border border-[#2a3645] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
                />
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {filtered.slice(0, 24).map((f) => {
                  const active = withUser === f.username;
                  return (
                    <button
                      key={f.username}
                      type="button"
                      onClick={() => pickFriend(f.username)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition-all ${
                        active
                          ? "border-[#7cc7e8] bg-[#7cc7e8]/10 shadow-sm shadow-[#7cc7e8]/10"
                          : "border-[#2a3645] bg-[#131e2c]/40 hover:border-[#3d5068]"
                      }`}
                    >
                      <Avatar
                        src={f.avatar_url}
                        name={f.username}
                        size={48}
                      />
                      <span
                        className={`text-[11px] font-medium truncate w-full text-center ${
                          active ? "text-[#7cc7e8]" : "text-stone-300"
                        }`}
                      >
                        @{f.username}
                      </span>
                    </button>
                  );
                })}
              </div>
              {filtered.length > 24 && (
                <p className="text-[11px] text-stone-600 mt-2 text-center">
                  Showing 24 of {filtered.length} — use the filter
                </p>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-stone-500 py-4 text-center">
                  No matches
                </p>
              )}
            </>
          )}
        </section>

        {/* select period */}
        <section className={`mt-8 ${!withUser ? "opacity-40 pointer-events-none" : ""}`}>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
            2 · Month
          </h2>
          <div className="flex flex-wrap gap-2">
            {periodChips.map((p) => {
              const active = p.year === year && p.month === month;
              return (
                <button
                  key={`${p.year}-${p.month}`}
                  type="button"
                  onClick={() => {
                    setYear(p.year);
                    setMonth(p.month);
                    setResult(null);
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "border-[#7cc7e8] bg-[#7cc7e8]/15 text-[#7cc7e8]"
                      : "border-[#2a3645] text-stone-400 hover:border-[#3d5068] hover:text-stone-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={runCompare}
            disabled={!withUser || busy}
            className="w-full sm:w-auto text-sm font-bold px-6 py-3 rounded-xl bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-35 transition-colors"
          >
            {busy
              ? "Comparing…"
              : selected
                ? `Compare with @${selected.username}`
                : "Compare"}
          </button>
          {selected && (
            <p className="text-xs text-stone-500">
              {MONTH_NAMES[month - 1]} {year}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* resultados */}
        {result && (
          <div className="mt-10 space-y-8 animate-in fade-in">
            {/* match card */}
            <div className="rounded-2xl border border-[#2a3645] bg-gradient-to-b from-[#131e2c] to-[#0a121c] p-5 sm:p-6">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <Avatar
                    src={user.avatar_url}
                    name={result.you?.username}
                    size={56}
                  />
                  <span className="text-xs text-stone-400 truncate max-w-[5.5rem]">
                    @{result.you?.username}
                  </span>
                </div>
                <div className="text-center flex-shrink-0">
                  <p className="text-4xl sm:text-5xl font-black text-[#7cc7e8] tabular-nums leading-none">
                    {result.stats?.affinity_percent ?? 0}%
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-stone-500 mt-1.5">
                    affinity
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1.5 min-w-0">
                  <Avatar
                    src={result.them?.avatar_url || selected?.avatar_url}
                    name={result.them?.username}
                    size={56}
                  />
                  <Link
                    href={`/${result.them?.username}`}
                    className="text-xs text-[#7cc7e8] hover:underline truncate max-w-[5.5rem]"
                  >
                    @{result.them?.username}
                  </Link>
                </div>
              </div>
              <p className="text-center text-xs text-stone-500 mt-4">
                {result.period?.label} · {result.stats?.common ?? 0} albums in
                common
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Yours", result.stats?.you_albums],
                  ["Shared", result.stats?.common],
                  ["Theirs", result.stats?.them_albums],
                ].map(([label, n]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[#0a121c]/80 border border-[#2a3645] py-2"
                  >
                    <p className="text-base font-bold tabular-nums">{n ?? 0}</p>
                    <p className="text-[10px] text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.common?.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Shared listens
                </h2>
                <ul className="space-y-2">
                  {commonPreview.map((item) => (
                    <li key={item.album_id}>
                      <AlbumRow
                        item={item}
                        right={
                          <>
                            <p>
                              <span className="text-[#7cc7e8]">
                                ×{item.you_plays}
                              </span>
                              <span className="text-stone-600"> / </span>
                              <span>×{item.them_plays}</span>
                            </p>
                            {(item.you_rating != null ||
                              item.them_rating != null) && (
                              <p className="text-yellow-400/90">
                                {item.you_rating != null
                                  ? `★${item.you_rating}`
                                  : "—"}
                                <span className="text-stone-600"> / </span>
                                {item.them_rating != null
                                  ? `★${item.them_rating}`
                                  : "—"}
                              </p>
                            )}
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
                {(result.common?.length || 0) > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCommon((v) => !v)}
                    className="mt-3 text-xs text-[#7cc7e8] hover:underline"
                  >
                    {showAllCommon
                      ? "Show less"
                      : `Show all ${result.common.length}`}
                  </button>
                )}
              </section>
            )}

            {result.both_rated?.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Rating gaps
                </h2>
                <ul className="space-y-2">
                  {result.both_rated.slice(0, 5).map((item) => (
                    <li key={item.album_id}>
                      <AlbumRow
                        item={item}
                        right={
                          <p className="text-yellow-400">
                            ★{item.you_rating}
                            <span className="text-stone-600"> vs </span>
                            ★{item.them_rating}
                          </p>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Only you
                </h2>
                {result.only_you?.length ? (
                  <ul className="space-y-2">
                    {result.only_you.slice(0, 5).map((item) => (
                      <li key={item.album_id}>
                        <AlbumRow
                          item={item}
                          right={
                            <span className="text-[#7cc7e8]">
                              ×{item.plays}
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-600">Nothing exclusive</p>
                )}
              </section>
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Only @{result.them?.username}
                </h2>
                {result.only_them?.length ? (
                  <ul className="space-y-2">
                    {result.only_them.slice(0, 5).map((item) => (
                      <li key={item.album_id}>
                        <AlbumRow
                          item={item}
                          right={<span>×{item.plays}</span>}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-600">Nothing exclusive</p>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
