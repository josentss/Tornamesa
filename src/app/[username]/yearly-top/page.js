"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (value) => new Intl.NumberFormat("en").format(value || 0);
const root = (username) => "/" + encodeURIComponent(username);

function AlbumRow({ album, featured = false, numbered = true }) {
  return (
    <Link href={"/album/" + encodeURIComponent(album.albumId)}
      className={"group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors " +
        (featured ? "border-[#7cc7e8]/40 bg-[#131e2c]" :
          "border-[#2a3645] bg-[#131e2c]/60 hover:border-[#3d5068]")}>
      {numbered && <span className={"w-6 shrink-0 text-center font-semibold tabular-nums " +
        (featured ? "text-lg text-[#7cc7e8]" : "text-sm text-stone-500")}>{album.rank}</span>}
      <div className={"relative shrink-0 overflow-hidden rounded-lg bg-[#1f2b3a] " +
        (featured ? "h-14 w-14" : "h-12 w-12")}>
        {album.cover && <Image src={album.cover} alt={album.title} fill
          sizes={featured ? "56px" : "48px"} className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white group-hover:text-[#7cc7e8]">{album.title}</p>
        <p className="mt-0.5 truncate text-xs text-stone-500">{album.artist}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-xs font-bold tabular-nums text-[#7cc7e8]">×{fmt(album.count)}</span>
        {album.rating != null && <span className="text-[11px] text-stone-400">
          ★ {Number(album.rating).toFixed(1)}
        </span>}
      </div>
    </Link>
  );
}

function Activity({ monthly }) {
  const months = Array.from({ length: 12 }, (_, i) =>
    monthly.find((entry) => entry.month === i + 1) || { month: i + 1, listens: 0 });
  const max = Math.max(1, ...months.map((m) => m.listens));
  const peak = months.find((m) => m.listens === max);
  return (
    <section aria-label="Monthly listening activity" className="rounded-xl border border-[#2a3645] bg-[#131e2c]/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Listening through the year</h2>
          <p className="mt-1 text-xs text-stone-500">Album listens by month</p>
        </div>
        {peak && <p className="text-xs text-stone-400">Most active: {MONTHS[peak.month - 1]}</p>}
      </div>
      <div className="mt-5 grid grid-cols-12 items-end gap-1.5 sm:gap-3">
        {months.map((m) => (
          <div key={m.month} title={MONTHS[m.month - 1] + ": " + m.listens + " listens"}
            aria-label={MONTHS[m.month - 1] + ": " + m.listens + " listens"}
            className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center bg-[#0a121c]/50">
              <div className={"w-full max-w-[30px] rounded-t-sm " +
                (m.listens === max && m.listens > 0 ? "bg-[#7cc7e8]" : "bg-[#3a6078]")}
                style={{ height: m.listens ? Math.max(5, m.listens / max * 100) + "%" : "2px" }} />
            </div>
            <span className="hidden text-[10px] text-stone-500 sm:block">{MONTHS[m.month - 1]}</span>
            <span className="text-[10px] text-stone-500 sm:hidden">{MONTHS[m.month - 1][0]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function YearlyContent() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedYear = searchParams.get("year");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allAlbums, setAllAlbums] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setAllAlbums(false);
    setShareMessage("");
    api.getYearlyTop(username, { year: requestedYear ?? undefined })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        if (requestedYear === null) router.replace(
          root(result.username) + "/yearly-top?year=" + result.year, { scroll: false });
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load yearly top"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username, requestedYear, router]);

  const s = data?.summary;
  const albums = data?.albums || [];
  const rated = data?.bestRated || [];
  const artists = data?.topArtists || [];
  const years = data?.availableYears || [];
  const countItems = [
    ["Albums", s?.uniqueAlbums],
    ["Artists", s?.uniqueArtists],
    ["First-time albums", s?.discoveries],
    ["Repeat listens", s?.repeatListens],
  ];

  async function share() {
    if (!data) return;
    const url = window.location.origin + root(data.username) +
      "/yearly-top?year=" + data.year;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Tornamesa · " + data.year + " Yearly Top", url });
        setShareMessage("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareMessage("Link copied");
      } else {
        setShareMessage("Sharing is unavailable in this browser");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setShareMessage("Could not share link");
    }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center py-20">
    <LoadingSpinner message="Loading yearly top..." />
  </div>;
  if (error || !data) return <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
    <ErrorMessage message={error || "Could not load yearly top"} />
  </div>;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12">
      <Link href={root(data.username)} className="text-xs text-stone-500 hover:text-[#7cc7e8]">
        ← @{data.username}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Yearly Top</h1>
          <p className="mt-1 text-sm text-stone-400">{data.year} in music</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="year-top-year" className="sr-only">Choose year</label>
          <select id="year-top-year" value={data.year} onChange={(event) => router.push(
            root(data.username) + "/yearly-top?year=" + event.target.value)}
            className="rounded-lg border border-[#2a3645] bg-[#1f2b3a] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#7cc7e8]">
            {years.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
          <button type="button" onClick={share}
            className="rounded-lg border border-[#2a3645] bg-[#1f2b3a] px-3 py-2 text-xs font-semibold text-[#7cc7e8] hover:border-[#7cc7e8]/40">
            Share link
          </button>
        </div>
      </div>
      {shareMessage && <p role="status" className="mt-2 text-right text-xs text-[#7cc7e8]">{shareMessage}</p>}
      <nav aria-label="Top periods" className="mt-6 flex gap-1 border-b border-[#2a3645] text-xs font-semibold">
        <Link href={root(data.username) + "/monthly-top"}
          className="px-4 py-3 text-stone-400 hover:text-white">Monthly</Link>
        <span aria-current="page" className="border-b-2 border-[#7cc7e8] px-4 py-3 text-[#7cc7e8]">Yearly</span>
      </nav>

      <section aria-label="Year in review" className="mt-6 rounded-xl border border-[#2a3645] bg-[#131e2c] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#7cc7e8]">
          {data.year} in albums
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">{fmt(s?.totalListens)}</span>
          <span className="text-sm text-stone-400">album listens</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#2a3645] pt-5 sm:grid-cols-4">
          {countItems.map(([label, count]) => <div key={label}>
            <p className="text-xl font-bold tabular-nums text-white sm:text-2xl">{fmt(count)}</p>
            <p className="mt-0.5 text-xs text-stone-500">{label}</p>
          </div>)}
        </div>
      </section>

      {s?.totalListens > 0 ? <>
        <div className="mt-5"><Activity monthly={data.monthly || []} /></div>
        <div className="mt-8 grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="min-w-0" aria-labelledby="yearly-albums">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="yearly-albums" className="text-base font-semibold">Most listened albums</h2>
              <span className="text-xs text-stone-500">Top {albums.length}</span>
            </div>
            <div className="space-y-2">
              {(allAlbums ? albums : albums.slice(0, 10)).map((album) =>
                <AlbumRow key={album.albumId} album={album} featured={album.rank === 1} />)}
            </div>
            {albums.length > 10 && <button type="button"
              onClick={() => setAllAlbums((value) => !value)}
              className="mt-4 w-full rounded-lg border border-[#2a3645] py-2.5 text-xs font-semibold text-stone-300 hover:border-[#7cc7e8]/40">
              {allAlbums ? "Show less" : "Show all " + albums.length + " albums"}
            </button>}
          </section>
          <div className="min-w-0 space-y-7">
            <section aria-labelledby="yearly-artists">
              <h2 id="yearly-artists" className="text-base font-semibold">Top artists</h2>
              <p className="mb-3 mt-1 text-xs text-stone-500">Based on each album&apos;s main artist</p>
              {artists.length ? <div className="overflow-hidden rounded-xl border border-[#2a3645] bg-[#131e2c]/60">
                {artists.map((artist, index) => <div key={artist.name}
                  className={"flex min-w-0 items-center gap-3 px-4 py-3 " +
                    (index ? "border-t border-[#2a3645]" : "")}>
                  <span className="w-5 text-center text-xs font-bold text-[#7cc7e8]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{artist.name}</p>
                    <p className="text-[11px] text-stone-500">{fmt(artist.albums)} albums</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-stone-300">×{fmt(artist.listens)}</span>
                </div>)}
              </div> : <p className="text-sm text-stone-500">No artist data available.</p>}
            </section>
            <section aria-labelledby="yearly-rated">
              <h2 id="yearly-rated" className="text-base font-semibold">Highest rated</h2>
              <p className="mb-3 mt-1 text-xs text-stone-500">Your general album ratings</p>
              {rated.length ? <div className="space-y-2">
                {rated.map((album) => <AlbumRow key={album.albumId} album={album} numbered={false} />)}
              </div> : <p className="rounded-xl border border-[#2a3645] bg-[#131e2c]/60 p-4 text-sm text-stone-500">
                No rated albums in this year.
              </p>}
            </section>
          </div>
        </div>
      </> : <div className="mt-7 rounded-xl border border-[#2a3645] bg-[#131e2c]/50 px-5 py-14 text-center">
        <p className="text-sm text-stone-300">No albums logged in {data.year}.</p>
        <p className="mt-1 text-xs text-stone-500">Choose another year to explore its listening history.</p>
      </div>}

      <p className="mt-9 text-xs leading-5 text-stone-500">
        First-time albums are albums you first logged during {data.year}.
        Imported listens count in their assigned months. Shared links respect privacy settings.
      </p>
    </main>
  );
}

export default function YearlyTopPage() {
  const { user } = useAuth();
  return <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#0a0f16] text-[#f0f9ff]">
    <Header user={user} />
    <Suspense fallback={<div className="flex flex-1 items-center justify-center py-20">
      <LoadingSpinner message="Loading yearly top..." />
    </div>}>
      <YearlyContent />
    </Suspense>
    <Footer />
  </div>;
}
