"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const CARDS = [
  ["summary", "Year in review"], ["album", "Album of the year"],
  ["albums", "Top five albums"], ["artists", "Top five artists"],
  ["insights", "Year in numbers"],
];
const COLORS = [
  { id: "night", label: "Night", color: "#7cc7e8", background: "#0a0f16" },
  { id: "ocean", label: "Ocean", color: "#78e1d4", background: "#0b1521" },
  { id: "violet", label: "Violet", color: "#bba4ff", background: "#12101e" },
  { id: "ember", label: "Ember", color: "#ffa48b", background: "#1b1013" },
  { id: "forest", label: "Forest", color: "#b8e18e", background: "#101810" },
];

const focus = " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cc7e8]";
const button = "rounded-lg border border-[#2a3645] px-3 py-2.5 text-sm font-semibold text-stone-200 hover:border-[#7cc7e8]/60 disabled:opacity-40" + focus;
const cacheKey = (card, color) => card + ":" + color;

export default function YearlyWrappedGallery({ username, year, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const track = useRef(null);
  const settleTimer = useRef(null);
  const cache = useRef(new Map());
  const indexRef = useRef(0);
  const mounted = useRef(false);
  const shareLock = useRef(false);
  const [index, setIndex] = useState(0);
  const [color, setColor] = useState("night");
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  const [card, title] = CARDS[index];
  const key = cacheKey(card, color);
  const current = result?.key === key ? result : null;
  const ready = !!current?.url && !scrolling && !sharing;

  useEffect(() => {
    mounted.current = true;
    const node = dialog.current;
    const opener = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      mounted.current = false;
      clearTimeout(settleTimer.current);
      node.close();
      document.body.style.overflow = originalOverflow;
      for (const entry of cache.current.values()) URL.revokeObjectURL(entry.url);
      cache.current.clear();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const node = track.current;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      node.scrollLeft = indexRef.current * node.clientWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Fetch only the settled slide and selected color, not every combination.
  // Cancellation and key matching prevent stale images from replacing the active one.
  useEffect(() => {
    setMessage("");
    if (scrolling) return;
    const cached = cache.current.get(key);
    if (cached) {
      setResult(cached);
      return;
    }
    const controller = new AbortController();
    setResult({ key, loading: true });
    const timer = setTimeout(async () => {
      try {
        const blob = await api.getYearlyTopImage(username, {
          year, card, theme: color, signal: controller.signal,
        });
        if (controller.signal.aborted || !mounted.current) return;
        const entry = { key, blob, url: URL.createObjectURL(blob) };
        cache.current.set(key, entry);
        setResult(entry);
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;
        setResult({ key, error: error?.message || "Could not generate the yearly image" });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, year, key, card, color, retry, scrolling]);

  function selectSlide(next) {
    const value = Math.max(0, Math.min(CARDS.length - 1, next));
    clearTimeout(settleTimer.current);
    indexRef.current = value;
    setIndex(value);
    setScrolling(false);
    const node = track.current;
    if (node) node.scrollLeft = value * node.clientWidth;
  }

  function handleScroll() {
    const node = track.current;
    if (!node?.clientWidth) return;
    const exact = indexRef.current * node.clientWidth;
    if (Math.abs(node.scrollLeft - exact) < 2) {
      clearTimeout(settleTimer.current);
      setScrolling(false);
      return;
    }
    setScrolling(true);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      const next = Math.max(0, Math.min(CARDS.length - 1,
        Math.round(node.scrollLeft / node.clientWidth)));
      indexRef.current = next;
      setIndex(next);
      setScrolling(false);
    }, 140);
  }

  function handleKeys(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectSlide(indexRef.current + (event.key === "ArrowRight" ? 1 : -1));
  }

  async function exportImage(preferShare) {
    // Use the exact blob being previewed. No additional render or fetch.
    if (!ready || shareLock.current) return;
    shareLock.current = true;
    setSharing(true);
    setMessage("");
    const image = current.blob;
    const safeUsername = String(username).replace(/[^a-z0-9_-]/gi, "_");
    const name = "tornamesa-" + safeUsername + "-" + year + "-" + card + "-" + color + ".png";
    try {
      if (preferShare && typeof File !== "undefined" && typeof navigator.share === "function") {
        const file = new File([image], name, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: "Tornamesa · " + year + " Yearly Top" });
            if (mounted.current) setMessage("Image shared");
            return;
          } catch (shareError) {
            if (shareError?.name === "AbortError") return;
          }
        }
      }
      // Native file sharing is not available in every browser.
      if (!mounted.current) return;
      const objectUrl = URL.createObjectURL(image);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      setMessage(preferShare ? "Image downloaded" : "PNG downloaded");
    } catch (error) {
      if (mounted.current && error?.name !== "AbortError") {
        setMessage("Could not share or download the image");
      }
    } finally {
      shareLock.current = false;
      if (mounted.current) setSharing(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="wrapped-gallery-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto max-h-[100dvh] w-full max-w-[500px] overflow-y-auto border-0 bg-[#0a0f16] p-0 text-[#f0f9ff] backdrop:bg-black/85 sm:max-h-[95dvh] sm:rounded-2xl sm:border sm:border-[#2a3645]">
      <div className="flex min-h-[100dvh] flex-col justify-center gap-3 px-3 py-3 sm:min-h-0 sm:px-5 sm:py-4">
        <header className="flex shrink-0 items-center justify-between gap-2">
          <h2 id="wrapped-gallery-title" className="text-sm font-semibold">Your {year} Wrapped</h2>
          <button ref={closeButton} type="button" onClick={onClose}
            aria-label="Close Wrapped" className={"h-10 w-10 rounded-full text-xl text-stone-300 hover:bg-white/10" + focus}>×</button>
        </header>

        <div aria-roledescription="carousel" aria-label="Yearly Wrapped stories">
          <div className="flex items-center justify-between gap-1">
            <button type="button" aria-label="Previous story" disabled={index === 0 || sharing}
              onClick={() => selectSlide(index - 1)} className={"h-10 w-8 shrink-0 rounded-full text-2xl disabled:opacity-25" + focus}>‹</button>
            <div ref={track} onScroll={handleScroll} onKeyDown={handleKeys} tabIndex={0}
              aria-label="Swipe or use arrow keys to change story"
              className={"flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" + focus}
              style={{ touchAction: "pan-x pan-y" }}>
              {CARDS.map(([id, label], i) => {
                const active = i === index;
                const entry = active && current?.url ? current : cache.current.get(cacheKey(id, color));
                return (
                  <div key={id} role="group" aria-roledescription="slide"
                    aria-label={(i + 1) + " of " + CARDS.length + ": " + label}
                    aria-hidden={!active} className="flex w-full shrink-0 snap-center snap-always justify-center">
                    <div className="relative flex aspect-[4/5] w-full max-w-[400px] items-center justify-center overflow-hidden rounded-xl border border-[#2a3645] bg-[#131e2c]"
                      style={{ width: "min(100%, 400px, max(180px, calc((100dvh - 248px) * 0.8)))" }}>
                      {entry?.url ? (
                        <img src={entry.url} alt={label + " — " + year} draggable={false}
                          className="h-full w-full select-none object-contain" />
                      ) : active && current?.error ? (
                        <div className="flex flex-col items-center gap-3 px-5 text-center">
                          <p role="alert" className="text-sm text-stone-300">{current.error}</p>
                          <button type="button" onClick={() => setRetry((n) => n + 1)} className={button}>Try again</button>
                        </div>
                      ) : (
                        <p role={active ? "status" : undefined} className="px-4 text-center text-sm text-stone-400">
                          {active ? "Preparing image…" : label}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" aria-label="Next story" disabled={index === CARDS.length - 1 || sharing}
              onClick={() => selectSlide(index + 1)} className={"h-10 w-8 shrink-0 rounded-full text-2xl disabled:opacity-25" + focus}>›</button>
          </div>
          <div className="mt-2 flex justify-center" aria-label="Select story">
            {CARDS.map(([id, label], i) => (
              <button key={id} type="button" aria-label={label} aria-current={i === index ? "true" : undefined}
                onClick={() => selectSlide(i)} disabled={sharing} className={"flex h-8 w-8 items-center justify-center rounded-full" + focus}>
                <span aria-hidden="true" className={"h-2 w-2 rounded-full " + (i === index ? "bg-[#7cc7e8]" : "bg-stone-600")} />
              </button>
            ))}
          </div>
          <p aria-live="polite" className="text-center text-xs font-medium text-stone-300">{title} · {index + 1}/{CARDS.length}</p>
        </div>

        <fieldset className="shrink-0 text-center">
          <legend className="mx-auto text-xs text-stone-400">Color · {COLORS.find((item) => item.id === color)?.label}</legend>
          <div className="mt-2 flex justify-center gap-2">
            {COLORS.map((item) => (
              <button key={item.id} type="button" aria-label={"Use " + item.label + " color"}
                title={item.label} aria-pressed={color === item.id} disabled={sharing}
                onClick={() => setColor(item.id)}
                className={"flex h-10 w-10 items-center justify-center rounded-full border-2 " +
                  (color === item.id ? "border-white" : "border-[#3a4c60]") + focus}
                style={{ backgroundColor: item.background }}>
                <span aria-hidden="true" className="h-5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid shrink-0 grid-cols-2 gap-2" aria-label="Yearly image actions">
          <button type="button" onClick={() => exportImage(false)} disabled={!ready} className={button}>Download PNG</button>
          <button type="button" onClick={() => exportImage(true)} disabled={!ready}
            className={"rounded-lg bg-[#7cc7e8] px-3 py-2.5 text-sm font-semibold text-[#0a0f16] hover:bg-[#9ddbf2] disabled:opacity-40" + focus}>
            {sharing ? "Sharing…" : "Share image"}
          </button>
        </div>
        {message && <p role="status" aria-live="polite" className="text-center text-xs text-stone-400">{message}</p>}
      </div>
    </dialog>
  );
}
