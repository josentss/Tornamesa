"use client";

import { useState, useEffect } from "react";
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

function AlbumRow({ item, right }) {
  return (
    <Link
      href={`/album/${item.album_id}`}
      className="flex items-center gap-3 rounded-xl border border-[#2a3645] bg-[#131e2c]/60 px-2.5 py-2 hover:border-[#7cc7e8]/40 transition-colors group min-w-0"
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
  const [withUser, setWithUser] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(true);

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
        if (!cancelled) setFollowing(list);
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

  const runCompare = async () => {
    if (!user?.id || !withUser || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
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

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight">Compare</h1>
        <p className="text-sm text-stone-500 mt-1">
          See how your month lines up with someone you follow.
        </p>

        <div className="mt-6 rounded-2xl border border-[#2a3645] bg-[#131e2c]/50 p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1.5">
                Friend
              </label>
              <select
                value={withUser}
                onChange={(e) => setWithUser(e.target.value)}
                disabled={listLoading}
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
              >
                <option value="">
                  {listLoading ? "Loading…" : "Select…"}
                </option>
                {following.map((f) => {
                  const u =
                    f.username ||
                    f.profiles?.username ||
                    f.user?.username ||
                    "";
                  if (!u) return null;
                  return (
                    <option key={u} value={u}>
                      @{u}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1.5">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={runCompare}
            disabled={!withUser || busy}
            className="w-full sm:w-auto text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-40 transition-colors"
          >
            {busy ? "Comparing…" : "Compare"}
          </button>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {result && (
          <div className="mt-8 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wider font-bold">
                  {result.period?.label}
                </p>
                <p className="text-lg font-semibold mt-1">
                  <Link
                    href={`/${result.you?.username}`}
                    className="text-[#7cc7e8] hover:underline"
                  >
                    @{result.you?.username}
                  </Link>
                  <span className="text-stone-600 mx-2">vs</span>
                  <Link
                    href={`/${result.them?.username}`}
                    className="text-[#7cc7e8] hover:underline"
                  >
                    @{result.them?.username}
                  </Link>
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-[#7cc7e8] tabular-nums">
                  {result.stats?.affinity_percent ?? 0}%
                </p>
                <p className="text-[11px] text-stone-500">affinity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ["In common", result.stats?.common],
                ["Only you", result.stats?.only_you],
                ["Only them", result.stats?.only_them],
                ["Both rated", result.stats?.both_rated],
              ].map(([label, n]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#2a3645] bg-[#131e2c]/40 py-3 px-2"
                >
                  <p className="text-lg font-bold tabular-nums text-white">
                    {n ?? 0}
                  </p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wide">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {result.common?.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  In common
                </h2>
                <ul className="space-y-2">
                  {result.common.map((item) => (
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
              </section>
            )}

            {result.both_rated?.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Biggest rating gaps
                </h2>
                <ul className="space-y-2">
                  {result.both_rated.slice(0, 8).map((item) => (
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
                    {result.only_you.map((item) => (
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
                  <p className="text-xs text-stone-600">None</p>
                )}
              </section>
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Only @{result.them?.username}
                </h2>
                {result.only_them?.length ? (
                  <ul className="space-y-2">
                    {result.only_them.map((item) => (
                      <li key={item.album_id}>
                        <AlbumRow
                          item={item}
                          right={<span>×{item.plays}</span>}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-600">None</p>
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
