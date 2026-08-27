"use client";

import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/shared";
import HScroll from "@/components/home/HScroll";
import {
  groupOwnHistory,
  groupFriendsFeed,
} from "@/lib/dashboardGroup";

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
          loading="lazy"
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
const stripItemClass = "w-[132px] flex-shrink-0";

export default function DashboardView({
  username,
  feed,
  ownHistory,
  stats,
  friendsReviews,
  monthlyTop,
  toListen,
  dataReady,
}) {
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
}
