"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (value) => new Intl.NumberFormat("en").format(value || 0);
const root = (username) => "/" + encodeURIComponent(username);
const WRAPPED_CARDS = [
  ["summary", "Year in review"], ["album", "Album of the year"],
  ["albums", "Top five albums"], ["artists", "Top five artists"],
  ["insights", "Year in numbers"],
];
const WRAPPED_COLORS = [
  { id: "night", label: "Night", color: "#7cc7e8", background: "#0a0f16" },
  { id: "ocean", label: "Ocean", color: "#78e1d4", background: "#0b1521" },
  { id: "violet", label: "Violet", color: "#bba4ff", background: "#12101e" },
  { id: "ember", label: "Ember", color: "#ffa48b", background: "#1b1013" },
  { id: "forest", label: "Forest", color: "#b8e18e", background: "#101810" },
];

function AlbumRow({ album, featured = false, numbered = true }) {
  return (
    <Link href={"/album/" + encodeURIComponent(album.albumId)}
      className={"group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8] " +
        (featured ? "border-[#7cc7e8]/40 bg-[#131e2c]" :
          "border-[#2a3645] bg-[#131e2c]/60 hover:border-[#3d5068]")}>
      {numbered && <span className={"w-6 shrink-0 text-center font-semibold tabular-nums " +
        (featured ? "text-lg text-[#7cc7e8]" : "text-sm text-stone-500")}>{album.rank}</span>}
      <div className={"relative shrink-0 overflow-hidden rounded-lg bg-[#1f2b3a] " +
        (featured ? "h-14 w-14" : "h-12 w-12")}>
        {album.cover && <Image src={album.cover} alt="" fill
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
        {peak && <p className="text-xs text-stone-400">Most active: {MONTHS[peak.month - 1]} · {fmt(peak.listens)} listens</p>}
      </div>
      <div className="mt-5 grid grid-cols-12 items-end gap-1 sm:gap-3" aria-hidden="true">
        {months.map((m) => (
          <div key={m.month} title={MONTH_NAMES[m.month - 1] + ": " + fmt(m.listens) + " album listens"}
            className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center bg-[#0a121c]/50">
              <div className={"w-full max-w-[30px] rounded-t-sm " +
                (m.listens === max && m.listens > 0 ? "bg-[#7cc7e8]" : "bg-[#3a6078]")}
                style={{ height: m.listens ? Math.max(5, m.listens / max * 100) + "%" : "2px" }} />
            </div>
            <span className="text-[9px] text-stone-500 sm:text-[10px]">{MONTHS[m.month - 1]}</span>
          </div>
        ))}
      </div>
      <ol className="sr-only" aria-label="Monthly listening totals">
        {months.map((m) => <li key={m.month}>
          {MONTH_NAMES[m.month - 1]}: {fmt(m.listens)} album listens
        </li>)}
      </ol>
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
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [wrappedCard, setWrappedCard] = useState("summary");
  const [wrappedColor, setWrappedColor] = useState("night");
  const [previewOpen, setPreviewOpen] = useState(false);
  const imageCache = useRef(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setAllAlbums(false);
    setShareMessage("");
    setImageMessage("");
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

  // Blob URLs are local to this browser; do not cache private images persistently.
  useEffect(() => {
    if (imageCache.current?.url) URL.revokeObjectURL(imageCache.current.url);
    imageCache.current = null;
    setPreviewOpen(false);
    setImageMessage("");
  }, [wrappedCard, wrappedColor, requestedYear]);

  useEffect(() => () => {
    if (imageCache.current?.url) URL.revokeObjectURL(imageCache.current.url);
    imageCache.current = null;
  }, []);

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

  async function loadWrappedImage() {
    const key = [data.username, data.year, wrappedCard, wrappedColor].join(":");
    if (imageCache.current?.key === key) return imageCache.current.blob;
    const blob = await api.getYearlyTopImage(data.username, {
      year: data.year, card: wrappedCard, theme: wrappedColor,
    });
    if (imageCache.current?.url) URL.revokeObjectURL(imageCache.current.url);
    imageCache.current = { key, blob, url: URL.createObjectURL(blob) };
    return blob;
  }

  async function previewImage() {
    if (!data || imageBusy) return;
    setImageBusy(true);
    setImageMessage("");
    try {
      await loadWrappedImage();
      setPreviewOpen(true);
    } catch (err) {
      setImageMessage(err?.message || "Could not preview the image");
    } finally {
      setImageBusy(false);
    }
  }

  async function exportImage(preferShare = false) {
    if (!data || imageBusy) return;
    setImageBusy(true);
    setImageMessage("");
    try {
      const image = await loadWrappedImage();
      const safeUsername = String(data.username).replace(/[^a-z0-9_-]/gi, "_");
      const name = "tornamesa-" + safeUsername + "-" + data.year +
        "-" + wrappedCard + "-" + wrappedColor + ".png";

      if (preferShare && typeof File !== "undefined" && typeof navigator.share === "function") {
        const file = new File([image], name, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "Tornamesa · " + data.year + " Yearly Top" });
            setImageMessage("Image shared");
            return;
          } catch (shareError) {
            // A cancelled share should stay cancelled; activation failures
            // and unsupported share surfaces fall back to downloading the PNG.
            if (shareError?.name === "AbortError") return;
          }
        }
      }

      // Native file sharing is not available in every desktop/mobile browser.
      const objectUrl = URL.createObjectURL(image);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      setImageMessage(preferShare ? "Image downloaded — file sharing is unavailable here" : "PNG downloaded");
    } catch (err) {
      if (err?.name !== "AbortError") {
        setImageMessage(err?.message || "Could not generate the image");
      }
    } finally {
      setImageBusy(false);
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
            className="rounded-lg border border-[#2a3645] bg-[#1f2b3a] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#7cc7e8] focus-visible:ring-2 focus-visible:ring-[#7cc7e8]">
            {years.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
          <button type="button" onClick={share}
            className="rounded-lg border border-[#2a3645] bg-[#1f2b3a] px-3 py-2 text-xs font-semibold text-[#7cc7e8] hover:border-[#7cc7e8]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8]">
            Share link
          </button>
        </div>
      </div>
      {shareMessage && <p role="status" className="mt-2 text-right text-xs text-[#7cc7e8]">{shareMessage}</p>}
      <nav aria-label="Top periods" className="mt-6 flex gap-1 border-b border-[#2a3645] text-xs font-semibold">
        <Link href={root(data.username) + "/monthly-top"}
          className="px-4 py-3 text-stone-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8]">Monthly</Link>
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
      <section aria-label="Customize yearly image" className="mt-3 rounded-xl border border-[#2a3645] bg-[#131e2c]/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px] flex-1 sm:flex-none">
            <label htmlFor="wrapped-card" className="mb-1 block text-xs text-stone-400">Card</label>
            <select id="wrapped-card" value={wrappedCard} disabled={imageBusy}
              onChange={(event) => setWrappedCard(event.target.value)}
              className="w-full rounded-lg border border-[#2a3645] bg-[#1f2b3a] px-3 py-2 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8]">
              {WRAPPED_CARDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <fieldset className="flex-1">
            <legend className="mb-1 text-xs text-stone-400">Color</legend>
            <div className="flex flex-wrap gap-2">
              {WRAPPED_COLORS.map((color) => <button key={color.id} type="button"
                disabled={imageBusy} aria-label={"Use " + color.label + " color"}
                title={color.label} aria-pressed={wrappedColor === color.id}
                onClick={() => setWrappedColor(color.id)}
                className={"flex h-8 w-8 items-center justify-center rounded-full border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8] " +
                  (wrappedColor === color.id ? "border-white" : "border-[#3a4c60]")}
                style={{ backgroundColor: color.background }}>
                <span aria-hidden="true" className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: color.color }} />
              </button>)}
            </div>
          </fieldset>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2" aria-label="Yearly image actions">
          <button type="button" disabled={imageBusy}
            onClick={previewImage}
            className="rounded-lg border border-[#2a3645] px-3 py-2.5 text-xs font-semibold text-stone-300 hover:border-[#7cc7e8]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8] disabled:opacity-60">
            Preview image
          </button>
          <button type="button" disabled={imageBusy}
            onClick={() => exportImage(true)}
            className="rounded-lg border border-[#2a3645] bg-[#131e2c] px-3 py-2.5 text-xs font-semibold text-[#7cc7e8] hover:border-[#7cc7e8]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8] disabled:cursor-wait disabled:opacity-60">
            {imageBusy ? "Preparing PNG..." : "Share image"}
          </button>
          <button type="button" disabled={imageBusy}
            onClick={() => exportImage(false)}
            className="rounded-lg border border-[#2a3645] bg-[#131e2c] px-3 py-2.5 text-xs font-semibold text-stone-300 hover:border-[#7cc7e8]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8] disabled:cursor-wait disabled:opacity-60">
            Download PNG
          </button>
        </div>
        {imageMessage && <p role="status" aria-live="polite"
          className="mt-2 text-right text-xs text-stone-400">{imageMessage}</p>}
      </section>
      {previewOpen && imageCache.current?.url && <div role="dialog" aria-modal="true"
        aria-label="Yearly Wrapped image preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
        <div className="flex max-h-[95vh] w-full max-w-sm flex-col gap-3 rounded-xl bg-[#131e2c] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Yearly image preview</p>
            <button type="button" onClick={() => setPreviewOpen(false)}
              className="rounded-lg border border-[#2a3645] px-3 py-1.5 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7cc7e8]">Close</button>
          </div>
          <img src={imageCache.current.url} alt={WRAPPED_CARDS.find(([id]) => id === wrappedCard)?.[1] || "Yearly image"}
            className="max-h-[75vh] w-full object-contain" />
        </div>
      </div>}

      {s?.totalListens > 0 ? <>
        <div className="mt-5"><Activity monthly={data.monthly || []} /></div>
        <div className="mt-8 grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="min-w-0" aria-labelledby="yearly-albums">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="yearly-albums" className="text-base font-semibold">Most listened albums</h2>
              <span className="text-xs text-stone-500">Top {albums.length} of {fmt(s?.uniqueAlbums)} albums</span>
            </div>
            <div id="yearly-album-list" className="space-y-2">
              {(allAlbums ? albums : albums.slice(0, 10)).map((album) =>
                <AlbumRow key={album.albumId} album={album} featured={album.rank === 1} />)}
            </div>
            {albums.length > 10 && <button type="button" aria-controls="yearly-album-list" aria-expanded={allAlbums}
              onClick={() => setAllAlbums((value) => !value)}
              className="mt-4 w-full rounded-lg border border-[#2a3645] py-2.5 text-xs font-semibold text-stone-300 hover:border-[#7cc7e8]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8]">
              {allAlbums ? "Show less" : "Show top " + albums.length + " albums"}
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
