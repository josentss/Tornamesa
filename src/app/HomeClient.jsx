"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, EmptyState } from "@/components/shared";
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

const PublicHeader = () => (
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

function LandingView() {
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

function groupOwnHistory(history) {
  const map = {};
  (history || []).forEach((item) => {
    const album = item.albums;
    if (!album?.spotify_id) return;
    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    const key = `${day}_${album.spotify_id}`;
    if (!map[key]) {
      map[key] = {
        key,
        count: 0,
        rating: item.rating,
        listened_at: item.listened_at,
        album: {
          id: album.spotify_id,
          title: album.title,
          artist: album.artist,
          cover: album.cover_url,
        },
      };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.listened_at || "").localeCompare(a.listened_at || ""))
    .slice(0, 6);
}

function groupFriendsFeed(feed) {
  const map = {};
  (feed || []).forEach((item) => {
    if (!item.album_id) return;
    const day = (item.listened_at || "").split("T")[0] || "Unknown";
    const key = `${day}_${item.username || "user"}_${item.album_id}`;
    if (!map[key]) {
      map[key] = { ...item, key, count: 0 };
    }
    map[key].count += 1;
    if (item.rating != null) map[key].rating = item.rating;
    if (
      item.listened_at &&
      (!map[key].listened_at || item.listened_at > map[key].listened_at)
    ) {
      map[key].listened_at = item.listened_at;
    }
  });
  return Object.values(map)
    .sort((a, b) => (b.listened_at || "").localeCompare(a.listened_at || ""))
    .slice(0, 6);
}

const AlbumGridCard = ({
  href,
  cover,
  title,
  subtitle,
  rating,
  count,
  footerLeft,
}) => (
  <div className="group flex flex-col w-full min-w-0">
    <Link
      href={href}
      className="relative aspect-square w-full bg-[#131e2c] rounded-xl border border-[#2a3645] overflow-hidden shadow-sm transition-all duration-300 ease-out group-hover:border-[#7cc7e8]/50 group-hover:shadow-md group-hover:shadow-black/25"
    >
      {cover ? (
        <Image
          src={cover}
          alt={title}
          fill
          sizes="132px"
          className="object-cover"
          loading="lazy"   // ← ya está bien
        />
      ) : (
        <div className="w-full h-full bg-[#1f2b3a]" />
      )}
      {rating != null && (
        <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/70 text-yellow-400 px-1.5 py-0.5 rounded">
          ★ {rating}
        </span>
      )}
    </Link>
    <div className="mt-2 min-w-0">
      <Link
        href={href}
        className="block text-xs font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors"
      >
        {title}
      </Link>
      {subtitle && (
        <p className="text-[10px] text-stone-500 truncate">{subtitle}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">{footerLeft}</div>
        {count > 1 && (
          <span className="text-[10px] font-bold text-[#7cc7e8] bg-[#0a121c] px-1.5 py-0.5 rounded border border-[#2a3645] flex-shrink-0">
            ×{count}
          </span>
        )}
      </div>
    </div>
  </div>
);

const FriendReviewCard = ({ review }) => (
  <Link
    href={`/album/${review.album.id}?from=${encodeURIComponent(review.username || "")}&review=${review.id}#review-${review.id}`}
    className="flex flex-col bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-3 hover:border-[#3d5068] transition-colors group h-full min-w-0"
  >
    <div className="flex gap-3 min-w-0">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0 relative">
        {review.album.cover && (
          <Image
            src={review.album.cover}
            alt={review.album.title}
            fill
            className="object-cover"
            sizes="64px"
            loading="lazy"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
              {review.album.title}
            </p>
            <p className="text-[11px] text-stone-500 truncate">
              {review.album.artist}
            </p>
          </div>
          <span className="text-yellow-400 text-xs font-semibold flex-shrink-0">
            ★ {review.rating}
          </span>
        </div>
        {review.reviewText && (
          <p className="text-xs text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">
            {review.reviewText}
          </p>
        )}
      </div>
    </div>
    <div className="mt-2.5 pt-2 border-t border-[#2a3645]/80 flex items-center gap-1.5 min-w-0">
      <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center">
        {review.avatar_url ? (
          <Image
            src={review.avatar_url}
            alt={review.username}
            width={20}
            height={20}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-[9px] font-bold text-[#7cc7e8]">
            {(review.username || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-[11px] text-stone-400 truncate">
        @{review.username}
      </span>
    </div>
  </Link>
);

function HScroll({ children, resetKey = "" }) {
  const ref = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = 0;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 4);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [resetKey]);

  return (
    <div className="md:hidden relative max-w-full">
      {/* fade left degradado pa más*/}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-[#0a0f16] to-transparent transition-opacity duration-200 ${
          showLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* fade right degradado pa mostrar más */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-[#0a0f16] to-transparent transition-opacity duration-200 ${
          showRight ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={ref}
        className="overflow-x-auto overscroll-x-contain pb-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 w-max pr-2">{children}</div>
      </div>
    </div>
  );
}

const stripItemClass = "w-[132px] flex-shrink-0";

const DashboardView = ({
  username,
  feed,
  ownHistory,
  stats,
  friendsReviews,
  monthlyTop,
  toListen,
  dataReady,
}) => {
  const ownGrouped = groupOwnHistory(ownHistory);
  const friendsGrouped = groupFriendsFeed(feed);
  const reviewsSix = (friendsReviews || []).slice(0, 6);
  const topFive = (monthlyTop || []).slice(0, 5);
  const toListenItems = (toListen?.items || toListen?.albums || []).slice(0, 6);

  const monthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const renderTopCard = (entry, i, fixed) => {
    const id = entry.id || entry.album_id || entry.albumId;
    const cover = entry.cover || entry.cover_url || entry.album?.cover;
    const title = entry.title || entry.album?.title || "Album";
    const count = entry.count ?? entry.listen_count ?? entry.listens;
    return (
      <Link
        key={id || i}
        href={id ? `/album/${id}` : "#"}
        className={fixed ? `${stripItemClass} group` : "group min-w-0"}
      >
        <div
          className={
            fixed
              ? "relative w-[132px] h-[132px] rounded-xl overflow-hidden border border-[#2a3645] bg-[#131e2c] shadow-sm transition-all duration-300 ease-out group-hover:border-[#7cc7e8]/50 group-hover:shadow-md group-hover:shadow-black/25"
              : "relative aspect-square rounded-xl overflow-hidden border border-[#2a3645] bg-[#131e2c] shadow-sm transition-all duration-300 ease-out group-hover:border-[#7cc7e8]/50 group-hover:shadow-md group-hover:shadow-black/25"
          }
        >
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes={fixed ? "132px" : "20vw"}
              className="object-cover"
              loading={i < 3 ? "eager" : "lazy"}
            />
          ) : (
            <div className="w-full h-full bg-[#1f2b3a]" />
          )}
          <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/70 text-[#7cc7e8] w-5 h-5 rounded-full flex items-center justify-center">
            {i + 1}
          </span>
        </div>
        <p
          className={`mt-1.5 text-[11px] font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors ${
            fixed ? "w-[132px]" : ""
          }`}
        >
          {title}
        </p>
        {count != null && (
          <p className="text-[10px] text-stone-500">{count} plays</p>
        )}
      </Link>
    );
  };

  const friendFooter = (item) => (
    <Link
      href={`/${item.username}`}
      className="flex items-center gap-1.5 min-w-0"
    >
      <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center">
        {item.avatar_url ? (
          <Image
            src={item.avatar_url}
            alt=""
            width={20}
            height={20}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-[9px] font-bold text-[#7cc7e8]">
            {(item.username || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-[11px] text-stone-400 hover:text-white truncate transition-colors">
        {item.username}
      </span>
    </Link>
  );

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-9 sm:space-y-11 overflow-x-hidden">
      <div className="pt-1 sm:pt-2">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#f0f9ff]">
          {username ? (
            <>
              Welcome back,{" "}
              <span className="text-[#7cc7e8]">@{username}</span>
            </>
          ) : (
            "Welcome back"
          )}
        </h1>
        {(stats?.monthlyListens != null || stats?.yearlyListens != null) && (
          <p className="text-sm text-stone-500 mt-1.5">
            <span className="text-stone-400 font-medium tabular-nums">
              {stats?.monthlyListens ?? 0}
            </span>{" "}
            albums this month
            <span className="text-stone-600 mx-1.5">·</span>
            <span className="text-stone-400 font-medium tabular-nums">
              {stats?.yearlyListens ?? 0}
            </span>{" "}
            this year
            {typeof toListen?.itemCount === "number" &&
              toListen.itemCount > 0 && (
                <>
                  <span className="text-stone-600 mx-1.5">·</span>
                  <span className="text-stone-400 font-medium tabular-nums">
                    {toListen.itemCount}
                  </span>{" "}
                  to listen
                </>
              )}
          </p>
        )}
      </div>

      {dataReady && topFive.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-3 border-b border-[#2a3645] pb-2 mb-4">
            <div>
              <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
                This month
              </h2>
              <p className="text-[11px] text-stone-600 mt-0.5">{monthLabel}</p>
            </div>
            {username && (
              <Link
                href={`/${username}/monthly-top`}
                className="text-xs text-[#7cc7e8] hover:underline flex-shrink-0"
              >
                Full top
              </Link>
            )}
          </div>
          <HScroll
            resetKey={topFive.map((e) => e.id || e.album_id || "").join(",")}
          >
            {topFive.map((e, i) => renderTopCard(e, i, true))}
          </HScroll>
          <div className="hidden md:grid md:grid-cols-5 gap-4">
            {topFive.map((e, i) => renderTopCard(e, i, false))}
          </div>
        </section>
      )}

      {dataReady && toListenItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-4">
            <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
              To listen
            </h2>
            {username && (
              <Link
                href={`/${username}?tab=lists`}
                className="text-xs text-[#7cc7e8] hover:underline"
              >
                All lists
              </Link>
            )}
          </div>
          <HScroll
            resetKey={toListenItems
              .map((x) => x.id || x.album_id || "")
              .join(",")}
          >
            {toListenItems.map((item, i) => {
              const id =
                item.album_id || item.spotify_id || item.id || item.album?.id;
              const cover =
                item.cover ||
                item.cover_url ||
                item.album?.cover ||
                item.album?.cover_url;
              const title = item.title || item.album?.title || "Album";
              const artist = item.artist || item.album?.artist || "";
              const href =
                id && !String(id).startsWith("preview")
                  ? `/album/${id}`
                  : "#";
              return (
                <div key={id || i} className={stripItemClass}>
                  <AlbumGridCard
                    href={href}
                    cover={cover}
                    title={title}
                    subtitle={artist}
                  />
                </div>
              );
            })}
          </HScroll>
          <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-4">
            {toListenItems.map((item, i) => {
              const id =
                item.album_id || item.spotify_id || item.id || item.album?.id;
              const cover =
                item.cover ||
                item.cover_url ||
                item.album?.cover ||
                item.album?.cover_url;
              const title = item.title || item.album?.title || "Album";
              const artist = item.artist || item.album?.artist || "";
              const href =
                id && !String(id).startsWith("preview")
                  ? `/album/${id}`
                  : "#";
              return (
                <AlbumGridCard
                  key={id || i}
                  href={href}
                  cover={cover}
                  title={title}
                  subtitle={artist}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-4">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Friends activity
          </h2>
          <Link
            href="/discover"
            className="text-xs text-[#7cc7e8] hover:underline"
          >
            Discover
          </Link>
        </div>
        {friendsGrouped.length > 0 ? (
          <>
            <HScroll resetKey={friendsGrouped.map((x) => x.key).join(",")}>
              {friendsGrouped.map((item) => (
                <div key={item.key} className={stripItemClass}>
                  <AlbumGridCard
                    href={`/album/${item.album_id}`}
                    cover={item.album_cover}
                    title={item.album_title}
                    subtitle={item.artist_name}
                    rating={item.rating}
                    count={item.count}
                    footerLeft={friendFooter(item)}
                  />
                </div>
              ))}
            </HScroll>
            <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-4">
              {friendsGrouped.map((item) => (
                <AlbumGridCard
                  key={item.key}
                  href={`/album/${item.album_id}`}
                  cover={item.album_cover}
                  title={item.album_title}
                  subtitle={item.artist_name}
                  rating={item.rating}
                  count={item.count}
                  footerLeft={friendFooter(item)}
                />
              ))}
            </div>
          </>
        ) : dataReady ? (
          <EmptyState
            title="No friend activity yet"
            description="Follow people to see what they log."
            actionLabel="Discover people"
            actionHref="/discover"
          />
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-4">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Your recent activity
          </h2>
          <Link href="/diary" className="text-xs text-[#7cc7e8] hover:underline">
            Diary
          </Link>
        </div>
        {ownGrouped.length > 0 ? (
          <>
            <HScroll resetKey={ownGrouped.map((x) => x.key).join(",")}>
              {ownGrouped.map((entry) => (
                <div key={entry.key} className={stripItemClass}>
                  <AlbumGridCard
                    href={`/album/${entry.album.id}`}
                    cover={entry.album.cover}
                    title={entry.album.title}
                    subtitle={entry.album.artist}
                    rating={entry.rating}
                    count={entry.count}
                  />
                </div>
              ))}
            </HScroll>
            <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 gap-4">
              {ownGrouped.map((entry) => (
                <AlbumGridCard
                  key={entry.key}
                  href={`/album/${entry.album.id}`}
                  cover={entry.album.cover}
                  title={entry.album.title}
                  subtitle={entry.album.artist}
                  rating={entry.rating}
                  count={entry.count}
                />
              ))}
            </div>
          </>
        ) : dataReady ? (
          <EmptyState
            title="No listens yet"
            description="Search an album and log your first listen."
            actionLabel="Search albums"
            actionHref="/search"
          />
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-4">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Reviews from friends
          </h2>
        </div>
        {reviewsSix.length > 0 ? (
          <>
            {/* compactadas en lista (celular) */}
            <div className="md:hidden flex flex-col gap-2.5">
              {reviewsSix.map((review) => (
                <Link
                  key={review.id}
                  href={`/album/${review.album.id}?from=${encodeURIComponent(review.username || "")}&review=${review.id}#review-${review.id}`}
                  className="flex gap-3 p-2.5 rounded-xl border border-[#2a3645] bg-[#131e2c]/50 active:bg-[#131e2c] transition-colors"
                >
                  <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-[#1f2b3a]">
                    {review.album.cover && (
                      <Image
                        src={review.album.cover}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {review.album.title}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {review.album.artist}
                        </p>
                      </div>
                      <span className="text-yellow-400 text-xs font-semibold flex-shrink-0">
                        ★ {review.rating}
                      </span>
                    </div>
                    {review.reviewText && (
                      <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-snug">
                        {review.reviewText}
                      </p>
                    )}
                    <p className="text-[11px] text-stone-500 mt-1.5 truncate">
                      @{review.username}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* pc: todas las cards */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reviewsSix.map((review) => (
                <FriendReviewCard key={review.id} review={review} />
              ))}
            </div>
          </>
        ) : dataReady ? (
          <EmptyState
            title="No reviews from friends yet"
            description="When people you follow rate albums, they show up here."
          />
        ) : null}
      </section>
    </main>
  );
};

export default function HomeClient({ initialLoggedIn = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState([]);
  const [ownHistory, setOwnHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [username, setUsername] = useState(null);
  const [monthlyTop, setMonthlyTop] = useState([]);
  const [toListen, setToListen] = useState(null);
  const [dataReady, setDataReady] = useState(false);

  const needsOnboarding = !!user && user.onboarding_completed === false;

  const showDashboard = needsOnboarding
    ? false
    : loading
      ? initialLoggedIn || !!user
      : !!user;

  useEffect(() => {
    if (loading) return;
    if (user && user.onboarding_completed === false) {
      router.replace("/onboarding");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.onboarding_completed === false) {
      if (!initialLoggedIn) {
        setDataReady(false);
        setFeed([]);
        setOwnHistory([]);
        setStats(null);
        setFriendsReviews([]);
        setUsername(null);
        setMonthlyTop([]);
        setToListen(null);
      }
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        let uname = null;
        try {
          const profile = await api.getUserProfile(user.id);
          uname = profile?.username || null;
        } catch {
          uname = user.username || user.user_metadata?.username || null;
        }
        if (cancelled) return;
        setUsername(uname);

        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;

        const core = Promise.all([
          api.getFriendsFeed(user.id).catch(() => []),
          api.getUserHistory(user.id, 24, 0).catch(() => ({ history: [] })),
          uname
            ? api.getProfileStats(uname).catch(() => null)
            : Promise.resolve(null),
          api.getFriendsReviews(user.id).catch(() => []),
        ]).then(([feedRes, historyRes, statsRes, friendsReviewsRes]) => {
          if (cancelled) return;
          setFeed(Array.isArray(feedRes) ? feedRes : []);
          setOwnHistory(historyRes?.history || []);
          setStats(statsRes);
          setFriendsReviews(
            Array.isArray(friendsReviewsRes) ? friendsReviewsRes : []
          );
          setDataReady(true);
        });

        const secondary = Promise.all([
          uname
            ? api
                .getMonthlyTop(uname, { year, month, limit: 5 })
                .catch(() => null)
            : Promise.resolve(null),
          api.getUserLists(user.id).catch(() => ({ lists: [] })),
        ]).then(async ([monthlyRes, listsRes]) => {
          if (cancelled) return;

          const topEntries =
            monthlyRes?.albums ||
            monthlyRes?.entries ||
            monthlyRes?.top ||
            (Array.isArray(monthlyRes) ? monthlyRes : []);
          setMonthlyTop(Array.isArray(topEntries) ? topEntries : []);

          const lists = Array.isArray(listsRes)
            ? listsRes
            : listsRes?.lists || [];
          const systemList =
            lists.find(
              (l) =>
                l.isSystem === true ||
                l.is_system === true ||
                (l.name || "").toLowerCase() === "to listen"
            ) || null;

          if (!systemList?.id) {
            setToListen(null);
            return;
          }

          setToListen({
            id: systemList.id,
            itemCount: systemList.count ?? 0,
            items: [],
          });

          try {
            const full = await api.getList(systemList.id);
            if (cancelled) return;
            const items = full?.albums || full?.items || [];
            setToListen({
              id: systemList.id,
              itemCount:
                full?.list?.count ?? systemList.count ?? items.length,
              items: items
                .slice(0, 6)
                .map((it) => {
                  const alb = it.album || it;
                  return {
                    id: alb.id || alb.spotify_id || it.album_id,
                    album_id: alb.id || alb.spotify_id || it.album_id,
                    title: alb.title || it.title,
                    artist: alb.artist || it.artist,
                    cover: alb.cover || alb.cover_url || it.cover,
                  };
                })
                .filter((x) => x.id),
            });
          } catch {
          }
        });

        await Promise.all([core, secondary]);
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (!cancelled) setDataReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.onboarding_completed, initialLoggedIn]);

  if (needsOnboarding) {
    return <div className="min-h-screen bg-[#0a0f16]" />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      {showDashboard ? <Header user={user} /> : <PublicHeader />}

      {showDashboard ? (
        <DashboardView
          username={username}
          feed={feed}
          ownHistory={ownHistory}
          stats={stats}
          friendsReviews={friendsReviews}
          monthlyTop={monthlyTop}
          toListen={toListen}
          dataReady={dataReady}
        />
      ) : (
        <LandingView />
      )}

      <Footer />
    </div>
  );
}
