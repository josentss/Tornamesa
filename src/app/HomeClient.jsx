"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, EmptyState } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";

// public landing
const PublicHeader = () => (
  <header className="absolute top-0 w-full z-20 flex justify-between items-center px-6 py-4">
    <Link
      href="/"
      className="text-xl font-bold tracking-tighter text-[#f0f9ff]"
    >
      Tornamesa
    </Link>
    <nav className="flex items-center gap-4 text-xs md:text-sm font-semibold tracking-wider">
      <Link
        href="/auth/login"
        className="text-stone-300 hover:text-white transition-colors"
      >
        Log in
      </Link>
      <Link
        href="/auth/register"
        className="text-stone-300 hover:text-white transition-colors"
      >
        Create account
      </Link>
    </nav>
  </header>
);

const LandingView = () => (
  <div className="flex-1 flex flex-col w-full bg-[#0a0f16]">
    <div className="relative w-full min-h-[75vh] flex flex-col justify-center px-6 md:px-12 lg:px-24 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/hero-bg.jpg"
          alt="Musical background"
          fill
          priority
          className="object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-[#0a0f16]/90 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-transparent to-transparent z-10" />
      </div>
      <div className="relative z-20 max-w-3xl space-y-8 mt-16">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.1]">
          <span className="text-[#f0f9ff]">Track the albums you listen to.</span>
          <br />
          <span className="text-stone-400">Save the ones you want to hear.</span>
          <br />
          <span className="text-[#87ceeb]">Share with friends what they play.</span>
        </h1>
        <p className="text-stone-400 max-w-xl text-lg font-light">
          Discover, rate, and share your love for music in this place.
        </p>
        <Link
          href="/auth/register"
          className="inline-block bg-[#87ceeb] text-[#0a0f16] px-8 py-3.5 rounded-md font-semibold hover:bg-white transition-all text-sm shadow-[0_0_15px_rgba(135,206,235,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        >
          Create free account
        </Link>
      </div>
    </div>
    <div className="w-full max-w-6xl mx-auto px-6 py-16 relative z-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            🎧
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Track your music</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Keep an exact diary of every album you play and rate them.
          </p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            📌
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Review records</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Write about an album you have listened to.
          </p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">
            👥
          </div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Interact with users</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            Discover new music by exploring the recent activity of people you follow.
          </p>
        </div>
      </div>
    </div>
  </div>
);

// helpers en dashboard

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
    const key = `${item.username || "user"}_${item.album_id}`;
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
      className="relative aspect-square w-full bg-[#131e2c] rounded-xl border border-[#2a3645] overflow-hidden transition-all duration-300 group-hover:border-[#7cc7e8]/40 shadow-sm"
    >
      {cover ? (
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
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
    href={`/album/${review.album.id}#reviews`}
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

const DashboardView = ({
  username,
  feed,
  ownHistory,
  stats,
  friendsReviews,
  dataReady,
}) => {
  const ownGrouped = groupOwnHistory(ownHistory);
  const friendsGrouped = groupFriendsFeed(feed);
  const reviewsSix = (friendsReviews || []).slice(0, 6);

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14 overflow-x-hidden">
      <section className="bg-[#131e2c]/80 border border-[#2a3645] rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">
              Welcome back
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {username ? `@${username}` : "Your home"}
            </h1>
            <div className="flex flex-wrap gap-4 sm:gap-6 mt-3 text-sm">
              <div>
                <span className="text-white font-semibold">
                  {stats?.monthlyListens ?? 0}
                </span>{" "}
                <span className="text-stone-500 text-xs">this month</span>
              </div>
              <div>
                <span className="text-white font-semibold">
                  {stats?.yearlyListens ?? 0}
                </span>{" "}
                <span className="text-stone-500 text-xs">this year</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/search"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] transition-colors"
            >
              Search
            </Link>
            <Link
              href="/diary"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] hover:border-[#3d5068] transition-colors"
            >
              Diary
            </Link>
            {username && (
              <Link
                href={`/${username}`}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] hover:border-[#3d5068] transition-colors"
              >
                Profile
              </Link>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            What your friends are listening to
          </h2>
        </div>
        {friendsGrouped.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
            {friendsGrouped.map((item) => (
              <AlbumGridCard
                key={item.key}
                href={`/album/${item.album_id}`}
                cover={item.album_cover}
                title={item.album_title}
                subtitle={item.artist_name}
                rating={item.rating}
                count={item.count}
                footerLeft={
                  <Link
                    href={`/${item.username}`}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0 flex items-center justify-center">
                      {item.avatar_url ? (
                        <Image
                          src={item.avatar_url}
                          alt={item.username}
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
                }
              />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No recent activity from people you follow"
            description="Follow users to see what they are listening to."
            actionLabel="Find people or albums"
            actionHref="/search"
          />
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Your recent activity
          </h2>
          <Link href="/diary" className="text-xs text-[#7cc7e8] hover:underline">
            View diary
          </Link>
        </div>
        {ownGrouped.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
            {ownGrouped.map((entry) => (
              <AlbumGridCard
                key={entry.key}
                href={`/album/${entry.album.id}`}
                cover={entry.album.cover}
                title={entry.album.title}
                subtitle={entry.album.artist}
                rating={entry.rating}
                count={entry.count}
                footerLeft={
                  <span className="text-[10px] text-stone-500 truncate">You</span>
                }
              />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No listens yet"
            description="Log an album to start your diary."
            actionLabel="Log your first album"
            actionHref="/search"
          />
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between border-b border-[#2a3645] pb-2 mb-5">
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            Reviews from friends
          </h2>
        </div>
        {reviewsSix.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reviewsSix.map((review) => (
              <FriendReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : dataReady ? (
          <EmptyState
            title="No reviews from people you follow yet"
            description="When friends rate albums, their reviews will show up here."
          />
        ) : null}
      </section>
    </main>
  );
};

// client page
export default function HomeClient({ initialLoggedIn = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState([]);
  const [ownHistory, setOwnHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [username, setUsername] = useState(null);
  const [dataReady, setDataReady] = useState(false);

  const needsOnboarding =
    !!user && user.onboarding_completed === false;

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
          uname =
            user.username || user.user_metadata?.username || null;
        }

        const [feedRes, historyRes, statsRes, friendsReviewsRes] =
          await Promise.all([
            api.getFriendsFeed(user.id).catch(() => []),
            api.getUserHistory(user.id, 30, 0).catch(() => ({ history: [] })),
            uname
              ? api.getProfileStats(uname).catch(() => null)
              : Promise.resolve(null),
            api.getFriendsReviews(user.id).catch(() => []),
          ]);

        if (cancelled) return;

        setUsername(uname);
        setFeed(Array.isArray(feedRes) ? feedRes : []);
        setOwnHistory(historyRes.history || []);
        setStats(statsRes);
        setFriendsReviews(
          Array.isArray(friendsReviewsRes) ? friendsReviewsRes : []
        );
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
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
          dataReady={dataReady}
        />
      ) : (
        <LandingView />
      )}

      <Footer />
    </div>
  );
}
