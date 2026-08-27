"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

function IconHeadphones({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function IconPen({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconUsers({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart({ className = "w-5 h-5" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-9" />
    </svg>
  );
}

export function PublicHeader() {
  return (
  <header className="absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 py-5">
    <div className="max-w-md mx-auto flex items-center justify-center gap-4 sm:gap-6">
      <Link
        href="/"
        className="text-lg sm:text-xl font-bold tracking-tighter text-[#f0f9ff] hover:text-white transition-colors"
      >
        Tornamesa
      </Link>
      <span className="w-px h-4 bg-[#2a3645]" aria-hidden />
      <Link
        href="/auth/login"
        className="text-xs sm:text-sm font-semibold text-stone-400 hover:text-white transition-colors"
      >
        Log in
      </Link>
      <Link
        href="/auth/register"
        className="text-xs sm:text-sm font-semibold text-[#0a0f16] bg-[#87ceeb] hover:bg-white px-3.5 py-1.5 rounded-full transition-colors"
      >
        Sign up
      </Link>
    </div>
  </header>
  );
}

const FEATURES = [
  {
    n: "01",
    title: "Log the record",
    body: "Finish an album, mark it once. Dates, repeats, and a diary that stays honest.",
    Icon: IconHeadphones,
  },
  {
    n: "02",
    title: "Score when it counts",
    body: "1–10 and a short note if you feel like writing. Nothing forced.",
    Icon: IconPen,
  },
  {
    n: "03",
    title: "Own the month",
    body: "Your top albums, past months, and a wrapped image when you want to share.",
    Icon: IconChart,
  },
  {
    n: "04",
    title: "Social activity",
    body: "Follow friends or keep the diary private. Either way the log is yours.",
    Icon: IconUsers,
  },
];

function PopularRail({ albums }) {
  if (!albums?.length) return null;

  const loop = [...albums, ...albums];

  return (
    <section className="relative z-20 w-full py-10 sm:py-12 border-y border-[#1e293b]/60 bg-[#0c1219]/50">
      <div className="max-w-5xl mx-auto px-6 mb-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#87ceeb]/90 mb-1.5">
          On Tornamesa
        </p>
        <h2 className="text-base sm:text-lg font-semibold text-[#f0f9ff]">
          Most played albums
        </h2>
      </div>

      <div className="relative overflow-hidden group">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-16 z-10 bg-gradient-to-r from-[#0a0f16] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-16 z-10 bg-gradient-to-l from-[#0a0f16] to-transparent" />

        <div className="flex gap-3 sm:gap-3.5 w-max animate-tornamesa-marquee group-hover:[animation-play-state:paused] py-1 px-2">
          {loop.map((a, i) => (
            <Link
              key={`${a.id}-${i}`}
              href={`/album/${a.id}`}
              className="flex-shrink-0 w-[100px] sm:w-[120px] group/card"
              title={a.title ? `${a.title} — ${a.artist}` : undefined}
            >
              <div className="relative aspect-square rounded-xl overflow-hidden border border-[#2a3645] bg-[#131e2c] shadow-md shadow-black/25 transition-transform duration-300 group-hover/card:-translate-y-0.5 group-hover/card:border-[#87ceeb]/35">
                {a.cover ? (
                  <Image
                    src={a.cover}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1a2433]" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes tornamesa-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .animate-tornamesa-marquee {
          animation: tornamesa-marquee 55s linear infinite;
        }
      `}</style>
    </section>
  );
}

export default function LandingView() {
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stats/popular-albums?limit=20", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setPopular(json.albums || []);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full bg-[#0a0f16]">
      <div className="relative w-full min-h-[70vh] sm:min-h-[75vh] flex flex-col items-center justify-center px-6 overflow-hidden text-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="/img/hero-bg.jpg"
            alt=""
            fill
            priority
            className="object-cover opacity-20 mix-blend-luminosity scale-105"
          />
          <div className="absolute inset-0 bg-[#0a0f16]/80 z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(135,206,235,0.07)_0%,_transparent_55%)] z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-transparent to-[#0a0f16]/90 z-10" />
        </div>

        <div className="relative z-20 max-w-2xl mx-auto space-y-6 pt-24 pb-14">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-[#87ceeb]">
            Album listening diary
          </p>

          <h1 className="text-[1.85rem] sm:text-4xl md:text-[2.75rem] font-semibold tracking-tight leading-[1.18] text-[#f0f9ff]">
            The albums you actually play.
            <span className="block mt-2 text-stone-400 font-medium">
              Logged. Rated. Remembered.
            </span>
          </h1>

          <p className="text-stone-400 text-sm sm:text-[15px] font-light leading-relaxed max-w-md mx-auto">
            A home for full records — not another stream of singles. Keep a
            diary, look back at your months, write when something sticks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-flex items-center justify-center bg-[#87ceeb] text-[#0a0f16] px-8 py-3 rounded-full font-semibold hover:bg-white transition-all text-sm shadow-[0_0_24px_rgba(135,206,235,0.22)]"
            >
              Create free account
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold text-stone-300 border border-[#2a3645] hover:border-[#3d5068] hover:text-white transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>

      <PopularRail albums={popular} />

      <div className="w-full max-w-2xl mx-auto px-6 py-16 sm:py-20 relative z-20">
        <div className="mb-10 sm:mb-12 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#87ceeb]/90 mb-2">
            The idea
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#f0f9ff] tracking-tight">
            Built around the record
          </h2>
        </div>

        <ul className="space-y-0 divide-y divide-[#1e293b]">
          {FEATURES.map(({ n, title, body, Icon }) => (
            <li
              key={n}
              className="flex gap-4 sm:gap-5 py-6 sm:py-7 first:pt-0 last:pb-0"
            >
              <span className="text-[11px] font-bold text-[#87ceeb]/70 tracking-widest w-7 flex-shrink-0 pt-1 tabular-nums">
                {n}
              </span>
              <div className="w-9 h-9 flex-shrink-0 rounded-full bg-[#131e2c] border border-[#2a3645] flex items-center justify-center text-[#87ceeb]">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 text-left">
                <h3 className="font-semibold text-[#f0f9ff] text-[15px] sm:text-base">
                  {title}
                </h3>
                <p className="text-stone-400 text-sm leading-relaxed mt-1.5">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full border-t border-[#1e293b]/80">
        <div className="max-w-md mx-auto px-6 py-14 text-center space-y-5">
          <h2 className="text-lg font-semibold text-[#f0f9ff] tracking-tight">
            Start with the next album you finish
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Free to join. Already track albums in notes? You can import those
            months later.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center bg-[#87ceeb] text-[#0a0f16] px-7 py-2.5 rounded-full font-semibold hover:bg-white transition-colors text-sm"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
