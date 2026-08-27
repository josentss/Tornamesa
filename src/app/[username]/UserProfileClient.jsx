"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Header, Footer, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import ProfileHeaderCard from "@/components/profile/ProfileHeaderCard";
import ProfileTabsPanel from "@/components/profile/ProfileTabsPanel";
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

      <ProfileHeaderCard
        profileData={profileData}
        profileStats={profileStats}
        displayName={displayName}
        isOwner={isOwner}
        isPrivateLocked={isPrivateLocked}
        actionLoading={actionLoading}
        shareCopied={shareCopied}
        onShare={handleShare}
        onFollowToggle={handleFollowToggle}
        onEditProfile={() => router.push("/settings/profile")}
      />

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

        <ProfileTabsPanel
          profileData={profileData}
          stats={stats}
          recentReviews={recentReviews}
          userLists={userLists}
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canShowActivity={canShowActivity}
          canShowDiaryLink={canShowDiaryLink}
          hasDiaryContent={hasDiaryContent}
          diaryBase={diaryBase}
          isOwner={!!isOwner}
          showNewList={showNewList}
          setShowNewList={setShowNewList}
          newListName={newListName}
          setNewListName={setNewListName}
          creatingList={creatingList}
          onCreateList={handleCreateList}
        />

</>
      )}

      <Footer />
    </div>
  );
}
