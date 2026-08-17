"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Header, Footer, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import ActivityFeed from "@/components/profile/ActivityFeed";
import MonthlyTopWidget from "@/components/profile/MonthlyTopWidget";
import RatingChart from "@/components/profile/RatingChart";
import ReviewsList from "@/components/profile/ReviewsList";
import Toast from "@/components/Toast";

export default function UserProfileClient({ params }) {
  const username = typeof params?.then === "function" ? null : params?.username;
  const [resolvedUsername, setResolvedUsername] = useState(username);
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("activity");
  const [toast, setToast] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

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

        const profileRes = await api.getPublicProfile(
          resolvedUsername,
          currentUser?.id
        );

        if (cancelled) return;

        setProfileData(profileRes.profile);

        if (profileRes.restricted) {
          setStats(null);
          setRecentReviews([]);
          setUserLists([]);
          return;
        }

        const [statsRes, reviewsRes] = await Promise.all([
          api.getProfileStats(resolvedUsername).catch(() => null),
          api
            .getUserReviews(resolvedUsername, 5, 0)
            .catch(() => ({ reviews: [] })),
        ]);

        if (cancelled) return;

        setStats(statsRes);
        setRecentReviews(reviewsRes.reviews || []);

        try {
          const listsRes = await api.getUserLists(profileRes.profile.id);
          if (!cancelled) setUserLists(listsRes.lists || []);
        } catch {
          if (!cancelled) setUserLists([]);
        }
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

  const isOwner =
    currentUser && profileData && currentUser.id === profileData.id;
  const isPrivateLocked = !!profileData?.is_private && !isOwner;
  const canShowActivity = isOwner || profileData?.show_activity !== false;
  const canShowDiaryLink =
    isOwner ||
    (profileData?.diary_public !== false && !isPrivateLocked);

  const diaryBase = profileData
    ? isOwner
      ? "/diary"
      : `/${profileData.username}/diary`
    : "/diary";

  const toListenList = userLists.find((l) => l.isSystem);
  const toListenCount = toListenList?.count ?? 0;

  const hasDiaryContent =
    (stats?.recentActivity?.length || 0) > 0 ||
    (stats?.yearlyListens || 0) > 0;

  const profileStats = [
    {
      value: stats?.yearlyListens || 0,
      label: "This Year",
      go: canShowDiaryLink
        ? () => router.push(`${diaryBase}?period=year`)
        : null,
      showPrivateHint: !canShowDiaryLink,
    },
    {
      value: stats?.monthlyListens || 0,
      label: "This Month",
      go: canShowDiaryLink
        ? () => router.push(`${diaryBase}?period=month`)
        : null,
      showPrivateHint: !canShowDiaryLink,
    },
    {
      value: toListenCount,
      label: "To Listen",
      go: toListenList?.id
        ? () => router.push(`/list/${toListenList.id}`)
        : null,
      showPrivateHint: false,
    },
  ];

  useEffect(() => {
    if (!profileData) return;
    if (!canShowActivity && activeTab === "activity") {
      setActiveTab("reviews");
    }
  }, [profileData, canShowActivity, activeTab]);

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
        setToast({
          message: `Unfollowed @${profileData.username}`,
          type: "success",
        });
      } else {
        await api.followUser(currentUser.id, profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: true,
          followers: (prev.followers || 0) + 1,
        }));
        setToast({
          message: `Now following @${profileData.username}`,
          type: "success",
        });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Something went wrong", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/${profileData.username}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setToast({ message: "Profile link copied!", type: "success" });
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setToast({ message: "Could not copy link", type: "error" });
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!currentUser || !isOwner || !newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await api.createList(currentUser.id, newListName.trim());
      setUserLists((prev) => [...prev, { ...res.list, previewCovers: [] }]);
      setNewListName("");
      setShowNewList(false);
      setToast({ message: "List created", type: "success" });
    } catch (err) {
      setToast({
        message: err.message || "Could not create list",
        type: "error",
      });
    } finally {
      setCreatingList(false);
    }
  };

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

  const tabs = [
    canShowActivity && { id: "activity", label: "Recent Activity" },
    { id: "reviews", label: "Reviews" },
    { id: "lists", label: "Lists" },
  ].filter(Boolean);

  const displayName = profileData.full_name || profileData.username;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={currentUser} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mt-16 sm:mt-20 animate-in fade-in duration-500">
        {/* profile pic encima del card bien ajustado */}
        <div className="relative bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl pt-14 sm:pt-16 md:pt-[4.75rem] pb-6 sm:pb-7 px-5 sm:px-6 md:px-7 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm">
          {/* profile pic */}
          <div className="absolute -top-12 sm:-top-14 md:-top-16 left-1/2 -translate-x-1/2 z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#7cc7e8]/20 blur-xl scale-110" />
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-[4px] sm:border-[5px] border-[#131e2c] bg-[#0a121c] overflow-hidden shadow-2xl ring-2 ring-[#7cc7e8]/50">
                {profileData.avatar_url ? (
                  <Image
                    src={profileData.avatar_url}
                    alt={`Avatar of ${profileData.username}`}
                    width={128}
                    height={128}
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

          {/* pc - stats, identity y actions. bien centrados vertical */}
          <div className="hidden md:grid md:grid-cols-[6.75rem_minmax(0,1fr)_6.75rem] lg:grid-cols-[7.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 lg:gap-4">
            {/* Stats */}
            <div className="justify-self-start">
              {!isPrivateLocked && (
                <div className="space-y-3 text-left">
                  {profileStats.map((s) => {
                    const clickable = typeof s.go === "function";
                    const Comp = clickable ? "button" : "div";
                    return (
                      <Comp
                        key={s.label}
                        type={clickable ? "button" : undefined}
                        onClick={clickable ? s.go : undefined}
                        className={`text-left w-full focus:outline-none ${
                          clickable ? "group cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <p
                          className={`text-xl lg:text-2xl font-bold tracking-tight leading-none transition-colors ${
                            clickable
                              ? "text-white group-hover:text-[#7cc7e8]"
                              : "text-stone-300"
                          }`}
                        >
                          {s.value}
                        </p>
                        <p className="text-[9px] lg:text-[10px] text-stone-500 uppercase tracking-wider mt-1">
                          {s.label}
                          {s.showPrivateHint && (
                            <span className="ml-1 normal-case tracking-normal text-stone-600">
                              private
                            </span>
                          )}
                        </p>
                      </Comp>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Identity — name alone, badges below */}
            <div className="text-center min-w-0 px-2">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
                {displayName}
              </h1>

              {(profileData.pronouns ||
                (profileData.is_private && isOwner)) && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                  {profileData.pronouns && (
                    <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-[#7cc7e8] px-2 py-0.5 rounded-md border border-[#2a3645]">
                      {profileData.pronouns}
                    </span>
                  )}
                  {profileData.is_private && isOwner && (
                    <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-stone-400 px-2 py-0.5 rounded-md border border-[#2a3645]">
                      Private
                    </span>
                  )}
                </div>
              )}

              <p className="text-stone-400 text-sm mt-1.5">
                @{profileData.username}
              </p>

              <div className="flex justify-center gap-6 mt-2.5 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/${profileData.username}/followers`)
                  }
                  className="hover:opacity-80 transition-opacity focus:outline-none"
                >
                  <strong className="text-white font-semibold">
                    {profileData.followers || 0}
                  </strong>{" "}
                  <span className="text-stone-400">Followers</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/${profileData.username}/following`)
                  }
                  className="hover:opacity-80 transition-opacity focus:outline-none"
                >
                  <strong className="text-white font-semibold">
                    {profileData.following || 0}
                  </strong>{" "}
                  <span className="text-stone-400">Following</span>
                </button>
              </div>

              {!isPrivateLocked && profileData.bio && (
                <p className="text-stone-300 text-sm mt-3 leading-relaxed max-w-sm mx-auto">
                  {profileData.bio}
                </p>
              )}
              {!isPrivateLocked && profileData.website && (
                <a
                  href={profileData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2.5 text-xs text-[#7cc7e8] hover:underline bg-[#0a121c] px-3 py-1 rounded-full border border-[#2a3645]"
                >
                  {profileData.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {/* action btns - centrados vertical bien */}
            <div className="justify-self-end flex flex-col items-stretch gap-2 w-full max-w-[7.5rem]">
              <button
                type="button"
                onClick={handleShare}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all text-center ${
                  shareCopied
                    ? "bg-[#7cc7e8]/10 border-[#7cc7e8]/50 text-[#7cc7e8]"
                    : "bg-[#1f2b3a] hover:bg-[#2a3645] border-[#2a3645] text-white"
                }`}
              >
                {shareCopied ? "Copied!" : "Share"}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#2a3645] bg-[#1f2b3a] hover:bg-[#2a3645] text-white text-center"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={actionLoading}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-all text-center ${
                    profileData.isFollowing
                      ? "bg-transparent border-[#2a3645] text-white"
                      : "bg-[#7cc7e8] text-[#0a121c] border-transparent"
                  }`}
                >
                  {actionLoading
                    ? "..."
                    : profileData.isFollowing
                      ? "Following"
                      : "Follow"}
                </button>
              )}
            </div>
          </div>

          {/* datos en celular */}
          <div className="md:hidden text-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              {displayName}
            </h1>
            {(profileData.pronouns ||
              (profileData.is_private && isOwner)) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
                {profileData.pronouns && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-[#7cc7e8] px-2 py-0.5 rounded-md border border-[#2a3645]">
                    {profileData.pronouns}
                  </span>
                )}
                {profileData.is_private && isOwner && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-stone-400 px-2 py-0.5 rounded-md border border-[#2a3645]">
                    Private
                  </span>
                )}
              </div>
            )}
            <p className="text-stone-400 text-sm mt-1.5">
              @{profileData.username}
            </p>
            <div className="flex justify-center gap-6 mt-2.5 text-sm">
              <button
                type="button"
                onClick={() =>
                  router.push(`/${profileData.username}/followers`)
                }
                className="hover:opacity-80 focus:outline-none"
              >
                <strong className="text-white font-semibold">
                  {profileData.followers || 0}
                </strong>{" "}
                <span className="text-stone-400">Followers</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(`/${profileData.username}/following`)
                }
                className="hover:opacity-80 focus:outline-none"
              >
                <strong className="text-white font-semibold">
                  {profileData.following || 0}
                </strong>{" "}
                <span className="text-stone-400">Following</span>
              </button>
            </div>
            {!isPrivateLocked && profileData.bio && (
              <p className="text-stone-300 text-sm mt-3 leading-relaxed max-w-md mx-auto px-1">
                {profileData.bio}
              </p>
            )}
            {!isPrivateLocked && profileData.website && (
              <a
                href={profileData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2.5 text-xs text-[#7cc7e8] hover:underline bg-[#0a121c] px-3.5 py-1.5 rounded-full border border-[#2a3645]"
              >
                {profileData.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          {/* action btns en celular */}
          <div className="md:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-5">
            <button
              type="button"
              onClick={handleShare}
              className={`text-sm font-semibold px-4 py-2.5 rounded-lg border transition-all ${
                shareCopied
                  ? "bg-[#7cc7e8]/10 border-[#7cc7e8]/50 text-[#7cc7e8]"
                  : "bg-[#1f2b3a] hover:bg-[#2a3645] border-[#2a3645]"
              }`}
            >
              {shareCopied ? "Copied!" : "Share"}
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="bg-[#1f2b3a] hover:bg-[#2a3645] text-sm font-semibold px-6 py-2.5 rounded-lg border border-[#2a3645]"
              >
                Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={actionLoading}
                className={`text-sm font-semibold px-6 py-2.5 rounded-lg border transition-all ${
                  profileData.isFollowing
                    ? "bg-transparent border-[#2a3645] text-white"
                    : "bg-[#7cc7e8] text-[#0a121c] border-transparent"
                }`}
              >
                {actionLoading
                  ? "..."
                  : profileData.isFollowing
                    ? "Following"
                    : "Follow"}
              </button>
            )}
          </div>

          {/* mobile stats */}
          {!isPrivateLocked && (
            <div className="md:hidden grid grid-cols-3 gap-2 pt-4 mt-5 border-t border-[#2a3645]">
              {profileStats.map((s) => {
                const clickable = typeof s.go === "function";
                const Comp = clickable ? "button" : "div";
                return (
                  <Comp
                    key={s.label}
                    type={clickable ? "button" : undefined}
                    onClick={clickable ? s.go : undefined}
                    className={`text-center focus:outline-none ${
                      clickable ? "" : "cursor-default"
                    }`}
                  >
                    <p
                      className={`text-xl font-bold ${
                        clickable ? "text-white" : "text-stone-300"
                      }`}
                    >
                      {s.value}
                    </p>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
                      {s.label}
                      {s.showPrivateHint && (
                        <span className="block text-[8px] normal-case tracking-normal text-stone-600 mt-0.5">
                          private
                        </span>
                      )}
                    </p>
                  </Comp>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isPrivateLocked ? (
        <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-10 sm:mt-14 pb-20">
          <div className="bg-[#131e2c]/80 border border-[#2a3645] rounded-2xl p-8 text-center">
            <p className="text-stone-300 text-sm font-medium">
              This profile is private
            </p>
            <p className="text-stone-500 text-xs mt-2">
              Only @{profileData.username} can see their activity, lists and
              stats.
            </p>
          </div>
        </section>
      ) : (
        <>
          {profileData.favorite_albums?.length > 0 && (
            <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-10 sm:mt-14">
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-5 text-center">
                Favorite Albums
              </h2>
              <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-xs sm:max-w-md mx-auto">
                {profileData.favorite_albums.map((fav, idx) => (
                  <a
                    key={idx}
                    href={`/album/${fav.id}`}
                    className="block group"
                  >
                    <div className="aspect-square rounded-lg sm:rounded-xl overflow-hidden mb-2 border border-[#2a3645] group-hover:border-[#7cc7e8]/50">
                      {fav.coverUrl ? (
                        <Image
                          src={fav.coverUrl}
                          alt={fav.title}
                          width={160}
                          height={160}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1f2b3a]" />
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold truncate text-center group-hover:text-[#7cc7e8]">
                      {fav.title}
                    </p>
                    <p className="text-[10px] text-stone-500 truncate text-center">
                      {fav.artist}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-12 sm:mt-16 flex-1 pb-16 sm:pb-20">
            <div className="flex border-b border-[#2a3645] mb-6 sm:mb-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 sm:pb-3.5 px-4 sm:px-5 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-[#7cc7e8] text-[#7cc7e8]"
                      : "border-transparent text-stone-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
              <div className="flex-1 min-w-0">
                {activeTab === "activity" && canShowActivity && (
                  <div>
                    <ActivityFeed activities={stats?.recentActivity || []} />
                    {canShowDiaryLink && hasDiaryContent && (
                      <div className="mt-5 text-center sm:text-left">
                        <button
                          type="button"
                          onClick={() => router.push(diaryBase)}
                          className="text-xs text-[#7cc7e8] hover:underline"
                        >
                          View full diary
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "activity" && !canShowActivity && (
                  <p className="text-sm text-stone-500 py-8 text-center">
                    Recent activity is hidden.
                  </p>
                )}

                {activeTab === "reviews" && (
                  <div>
                    <ReviewsList
                      reviews={recentReviews}
                      emptyMessage="Reviews written by this user will appear here."
                      username={profileData.username}
                    />
                    {recentReviews.length > 0 && (
                      <div className="mt-5 text-center sm:text-left">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/${profileData.username}/reviews`)
                          }
                          className="text-xs text-[#7cc7e8] hover:underline"
                        >
                          View all reviews
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "lists" && (
                  <div className="space-y-4">
                    {isOwner && (
                      <div className="mb-2">
                        {showNewList ? (
                          <form
                            onSubmit={handleCreateList}
                            className="flex flex-col sm:flex-row gap-2"
                          >
                            <input
                              value={newListName}
                              onChange={(e) => setNewListName(e.target.value)}
                              placeholder="New list name"
                              className="flex-1 min-w-0 bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={
                                  creatingList || !newListName.trim()
                                }
                                className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] disabled:opacity-50"
                              >
                                {creatingList ? "..." : "Create"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNewList(false);
                                  setNewListName("");
                                }}
                                className="text-sm px-3 py-2 text-stone-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowNewList(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7cc7e8] border border-[#2a3645] hover:border-[#7cc7e8]/40 bg-[#0a121c]/50 hover:bg-[#0a121c] px-3 py-2 rounded-lg transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-3.5 h-3.5"
                              aria-hidden
                            >
                              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                            </svg>
                            Create new list
                          </button>
                        )}
                      </div>
                    )}

                    {userLists.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {userLists.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            onClick={() => router.push(`/list/${list.id}`)}
                            className="text-left bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors group flex items-center gap-3 overflow-hidden"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white group-hover:text-[#7cc7e8] transition-colors truncate">
                                {list.name}
                              </h4>
                              {list.description && (
                                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                                  {list.description}
                                </p>
                              )}
                              <p className="text-xs text-stone-400 mt-2">
                                {list.count} album
                                {list.count !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {list.previewCovers?.length > 0 && (
                              <div className="relative flex-shrink-0 w-[72px] h-12">
                                {list.previewCovers
                                  .slice(0, 3)
                                  .map((cover, i) => (
                                    <div
                                      key={i}
                                      className="absolute top-0 w-12 h-12 rounded-md overflow-hidden border border-[#0a0f16] shadow-md bg-[#1f2b3a]"
                                      style={{
                                        right: `${i * 10}px`,
                                        zIndex: 3 - i,
                                        opacity: 1 - i * 0.15,
                                      }}
                                    >
                                      <Image
                                        src={cover}
                                        alt=""
                                        width={48}
                                        height={48}
                                        className="object-cover w-full h-full"
                                      />
                                    </div>
                                  ))}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-stone-400 text-sm font-medium">
                          No lists yet
                        </p>
                        <p className="text-stone-500 text-xs mt-1">
                          Lists created by this user will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full lg:w-72 space-y-5 sm:space-y-6 flex-shrink-0">
                <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5">
                  <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                    Monthly Top
                  </h3>
                  <MonthlyTopWidget
                    albums={stats?.monthlyTop || []}
                    username={profileData.username}
                  />
                </div>
                <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5">
                  <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                    Rating Chart
                  </h3>
                  <div className="overflow-x-auto">
                    <RatingChart
                      distribution={stats?.ratingDistribution || {}}
                      username={profileData.username}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </div>
  );
}
