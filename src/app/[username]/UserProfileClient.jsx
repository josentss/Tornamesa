"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import ActivityFeed from "@/components/profile/ActivityFeed";
import MonthlyTopWidget from "@/components/profile/MonthlyTopWidget";
import RatingChart from "@/components/profile/RatingChart";
import ListsPreview from "@/components/profile/ListsPreview";
import Toast from "@/components/Toast";

export default function UserProfileClient({ params }) {
  const username = typeof params?.then === "function" ? null : params?.username;
  const [resolvedUsername, setResolvedUsername] = useState(username);
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("activity");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setResolvedUsername(p.username));
    } else if (params?.username) {
      setResolvedUsername(params.username);
    }
  }, [params]);

  useEffect(() => {
    if (!resolvedUsername) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const [profileRes, statsRes] = await Promise.all([
          api.getPublicProfile(resolvedUsername, currentUser?.id),
          api.getProfileStats(resolvedUsername),
        ]);
        if (cancelled) return;
        setProfileData(profileRes.profile);
        setStats(statsRes);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading profile:", err);
        setError("User not found or could not load information.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [resolvedUsername, currentUser?.id]);

  const isOwner = currentUser && profileData && currentUser.id === profileData.id;

  const handleFollowToggle = async () => {
    if (!currentUser) return router.push("/auth/login");
    setActionLoading(true);
    try {
      if (profileData.isFollowing) {
        await api.unfollowUser(currentUser.id, profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: false,
          followers: Math.max(0, (prev.followers || 0) - 1),
        }));
        setToast({ message: `Unfollowed @${profileData.username}`, type: "success" });
      } else {
        await api.followUser(currentUser.id, profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: true,
          followers: (prev.followers || 0) + 1,
        }));
        setToast({ message: `Now following @${profileData.username}`, type: "success" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Something went wrong", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // ========== SKELETON ==========
  if (loading || !resolvedUsername) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={currentUser} />
        <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mt-16 sm:mt-20 animate-pulse">
          <div className="relative bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl pt-16 sm:pt-20 pb-8 px-5 sm:px-6 md:px-10">
            <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full bg-[#1f2b3a] border-[4px] sm:border-[5px] border-[#131e2c]" />
            </div>
            <div className="flex flex-col items-center gap-4 pt-4">
              <div className="h-7 w-48 bg-[#1f2b3a] rounded" />
              <div className="h-4 w-28 bg-[#1f2b3a] rounded" />
              <div className="h-4 w-40 bg-[#1f2b3a] rounded mt-2" />
              <div className="h-16 w-full max-w-md bg-[#1f2b3a] rounded mt-4" />
            </div>
          </div>
          <div className="mt-14 flex justify-center gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-24 h-24 sm:w-28 sm:h-28 bg-[#1f2b3a] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={currentUser} />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12">
          <ErrorMessage message={error || "User not found"} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={currentUser} />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ========== PROFILE HEADER ========== */}
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mt-16 sm:mt-20 animate-in fade-in duration-500">
        <div className="relative bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl pt-16 sm:pt-20 pb-8 sm:pb-9 px-5 sm:px-6 md:px-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm">

          {/* Avatar */}
          <div className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#7cc7e8]/20 blur-xl scale-110" />
              <div
                className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full border-[4px] sm:border-[5px] border-[#131e2c] bg-[#0a121c] overflow-hidden shadow-2xl ring-2 ring-[#7cc7e8]/50"
                role="img"
                aria-label={`Avatar of ${profileData.username}`}
              >
                {profileData.avatar_url ? (
                  <Image
                    src={profileData.avatar_url}
                    alt={`Avatar of ${profileData.username}`}
                    width={144}
                    height={144}
                    className="object-cover w-full h-full"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl font-bold text-stone-400">
                    {profileData.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 lg:gap-10">

              {/* STATS - Desktop (clickable) */}
              <div className="hidden md:block w-36 lg:w-40 flex-shrink-0 order-1 pt-1">
                <div className="space-y-5 text-left">
                  <button
                    onClick={() => {}}
                    className="group text-left w-full focus:outline-none"
                  >
                    <p className="text-3xl font-bold text-white tracking-tight group-hover:text-[#7cc7e8] transition-colors">
                      {stats?.yearlyListens || 0}
                    </p>
                    <p className="text-[11px] text-stone-400 uppercase tracking-wider mt-0.5 group-hover:text-stone-300">
                      This Year
                    </p>
                  </button>
                  <button
                    onClick={() => {}}
                    className="group text-left w-full focus:outline-none"
                  >
                    <p className="text-3xl font-bold text-white tracking-tight group-hover:text-[#7cc7e8] transition-colors">
                      {stats?.monthlyListens || 0}
                    </p>
                    <p className="text-[11px] text-stone-400 uppercase tracking-wider mt-0.5 group-hover:text-stone-300">
                      This Month
                    </p>
                  </button>
                  <button
                    onClick={() => {}}
                    className="group text-left w-full focus:outline-none"
                  >
                    <p className="text-3xl font-bold text-white tracking-tight group-hover:text-[#7cc7e8] transition-colors">
                      0
                    </p>
                    <p className="text-[11px] text-stone-400 uppercase tracking-wider mt-0.5 group-hover:text-stone-300">
                      To Listen
                    </p>
                  </button>
                </div>
              </div>

              {/* INFO */}
              <div className="flex-1 text-center order-1 md:order-2 w-full">
                <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                    {profileData.full_name || profileData.username}
                  </h1>
                  {profileData.pronouns && (
                    <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-[#7cc7e8] px-2 sm:px-2.5 py-0.5 rounded-md border border-[#2a3645]">
                      {profileData.pronouns}
                    </span>
                  )}
                </div>

                <p className="text-stone-400 text-sm mt-1 sm:mt-1.5 tracking-wide">
                  @{profileData.username}
                </p>

                <div className="flex justify-center gap-6 sm:gap-8 mt-3 sm:mt-4 text-sm">
                  <span>
                    <strong className="text-white font-semibold">
                      {profileData.followers || 0}
                    </strong>{" "}
                    <span className="text-stone-400">Followers</span>
                  </span>
                  <span>
                    <strong className="text-white font-semibold">
                      {profileData.following || 0}
                    </strong>{" "}
                    <span className="text-stone-400">Following</span>
                  </span>
                </div>

                {profileData.bio && (
                  <p className="text-stone-300 text-sm mt-4 sm:mt-5 leading-relaxed max-w-md mx-auto px-2">
                    {profileData.bio}
                  </p>
                )}

                {profileData.website && (
                  <a
                    href={profileData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 sm:mt-4 text-xs text-[#7cc7e8] hover:text-white hover:underline bg-[#0a121c] px-3.5 py-1.5 rounded-full border border-[#2a3645] transition-colors focus:outline-none focus:ring-2 focus:ring-[#7cc7e8]/50"
                    aria-label={`Website of ${profileData.username}`}
                  >
                    {profileData.website.replace(/^https?:\/\//, "")}
                  </a>
                )}

                {profileData.nowPlaying?.isPlaying && (
                  <a
                    href={profileData.nowPlaying.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-[#0a121c] border border-[#2a3645] hover:border-[#1db954]/60 transition-all rounded-full px-4 py-2.5 mt-4 sm:mt-5 group max-w-full focus:outline-none focus:ring-2 focus:ring-[#1db954]/40"
                    aria-label="Currently listening"
                  >
                    <div className="text-[#1db954] group-hover:scale-110 transition-transform flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                        <circle cx="8" cy="12" r="2" />
                        <circle cx="16" cy="12" r="2" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-[#1db954] font-bold leading-none mb-0.5">
                        Listening now
                      </span>
                      <span className="text-sm font-semibold text-[#f0f9ff] leading-none truncate">
                        {profileData.nowPlaying.title}
                      </span>
                      <span className="text-xs text-stone-400 leading-none mt-0.5 truncate">
                        {profileData.nowPlaying.artist}
                      </span>
                    </div>
                  </a>
                )}
              </div>

              {/* BUTTON */}
              <div className="w-full md:w-36 lg:w-40 flex-shrink-0 flex justify-center md:justify-end order-3">
                {isOwner ? (
                  <button
                    onClick={() => router.push("/settings")}
                    className="w-full sm:w-auto bg-[#1f2b3a] hover:bg-[#2a3645] text-sm font-semibold px-6 py-2.5 rounded-lg border border-[#2a3645] transition-all hover:border-[#3d5068] focus:outline-none focus:ring-2 focus:ring-[#7cc7e8]/40"
                    aria-label="Edit profile"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <button
                    onClick={handleFollowToggle}
                    disabled={actionLoading}
                    className={`w-full sm:w-auto text-sm font-semibold px-6 py-2.5 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[#7cc7e8]/40 ${
                      profileData.isFollowing
                        ? "bg-transparent border-[#2a3645] text-white hover:bg-red-950/30 hover:border-red-800/40"
                        : "bg-[#7cc7e8] text-[#0a121c] border-transparent hover:bg-[#a5d8f0] shadow-lg shadow-[#7cc7e8]/20"
                    }`}
                    aria-label={profileData.isFollowing ? "Unfollow" : "Follow"}
                  >
                    {actionLoading ? "..." : profileData.isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </div>

            {/* STATS - Mobile (clickable) */}
            <div className="md:hidden grid grid-cols-3 gap-2 pt-2 border-t border-[#2a3645]">
              <button className="text-center focus:outline-none">
                <p className="text-xl font-bold text-white">{stats?.yearlyListens || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">This Year</p>
              </button>
              <button className="text-center focus:outline-none">
                <p className="text-xl font-bold text-white">{stats?.monthlyListens || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">This Month</p>
              </button>
              <button className="text-center focus:outline-none">
                <p className="text-xl font-bold text-white">0</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">To Listen</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========== FAVORITE ALBUMS ========== */}
      {profileData.favorite_albums?.length > 0 && (
        <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-10 sm:mt-14 animate-in fade-in duration-700">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-5 sm:mb-6 text-center">
            Favorite Albums
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-xs sm:max-w-md mx-auto">
            {profileData.favorite_albums.map((fav, idx) => (
              <a
                key={idx}
                href={`/album/${fav.id}`}
                className="block group focus:outline-none focus:ring-2 focus:ring-[#7cc7e8]/40 rounded-xl"
                aria-label={`${fav.title} by ${fav.artist}`}
              >
                <div className="aspect-square rounded-lg sm:rounded-xl overflow-hidden mb-2 border border-[#2a3645] group-hover:border-[#7cc7e8]/50 transition-all duration-300 shadow-md group-hover:shadow-[#7cc7e8]/10 group-hover:-translate-y-0.5 sm:group-hover:-translate-y-1">
                  {fav.coverUrl ? (
                    <Image
                      src={fav.coverUrl}
                      alt={fav.title}
                      width={160}
                      height={160}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1f2b3a] flex items-center justify-center text-stone-600 text-xs">
                      No cover
                    </div>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs font-semibold truncate text-center group-hover:text-[#7cc7e8] transition-colors">
                  {fav.title}
                </p>
                <p className="text-[10px] text-stone-500 truncate text-center mt-0.5">
                  {fav.artist}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ========== DETAILED SECTION WITH TABS ========== */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-12 sm:mt-16 flex-1 pb-16 sm:pb-20 animate-in fade-in duration-700">
        {/* Tabs */}
        <div className="flex border-b border-[#2a3645] mb-6 sm:mb-8 overflow-x-auto scrollbar-hide">
          {[
            { id: "activity", label: "Recent Activity" },
            { id: "reviews", label: "Reviews" },
            { id: "lists", label: "Lists" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 sm:pb-3.5 px-4 sm:px-5 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap focus:outline-none ${
                activeTab === tab.id
                  ? "border-[#7cc7e8] text-[#7cc7e8]"
                  : "border-transparent text-stone-400 hover:text-white"
              }`}
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {activeTab === "activity" && (
              <ActivityFeed activities={stats?.recentActivity || []} />
            )}

            {activeTab === "reviews" && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#1f2b3a] flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-500">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <p className="text-stone-400 text-sm font-medium">No reviews yet</p>
                <p className="text-stone-500 text-xs mt-1 max-w-[240px]">
                  Reviews written by this user will appear here.
                </p>
              </div>
            )}

            {activeTab === "lists" && (
              <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
                <ListsPreview lists={stats?.lists || []} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 space-y-5 sm:space-y-6 flex-shrink-0">
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors">
              <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                Monthly Top
              </h3>
              <MonthlyTopWidget albums={stats?.monthlyTop || []} />
            </div>

            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors">
              <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                Rating Distribution
              </h3>
              <div className="overflow-x-auto">
                <RatingChart distribution={stats?.ratingDistribution || {}} />
              </div>
            </div>

            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors">
              <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                Lists
              </h3>
              <ListsPreview lists={stats?.lists || []} />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
