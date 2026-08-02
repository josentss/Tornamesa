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

export default function UserProfilePage({ params }) {
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
    return () => { cancelled = true; };
  }, [resolvedUsername, currentUser?.id]);

  const isOwner = currentUser && profileData && currentUser.id === profileData.id;

  const handleFollowToggle = async () => {
    if (!currentUser) return router.push("/auth/login");
    setActionLoading(true);
    try {
      if (profileData.isFollowing) {
        await api.unfollowUser(currentUser.id, profileData.id);
        setProfileData(prev => ({ ...prev, isFollowing: false, followers: Math.max(0, (prev.followers || 0) - 1) }));
      } else {
        await api.followUser(currentUser.id, profileData.id);
        setProfileData(prev => ({ ...prev, isFollowing: true, followers: (prev.followers || 0) + 1 }));
      }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  if (loading || !resolvedUsername) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={currentUser} />
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner message="Loading profile..." /></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={currentUser} />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12"><ErrorMessage message={error || "User not found"} /></main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={currentUser} />

      {/* CONTENEDOR PRINCIPAL CON AVATAR SOBRESALIENDO */}
      <div className="relative w-full max-w-5xl mx-auto px-4 md:px-8 mt-12">
        {/* Fondo decorativo detrás del avatar (opcional) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-[#0a0f16] border-4 border-[#2a3645] z-10 overflow-hidden">
          {profileData.avatar_url ? (
            <Image
              src={profileData.avatar_url}
              alt={profileData.username}
              width={128}
              height={128}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-stone-400">
              {profileData.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* CARD PRINCIPAL DE INFORMACIÓN */}
        <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl pt-20 pb-6 px-6 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* ESTADÍSTICAS (izquierda) */}
            <div className="flex flex-col gap-3 w-full md:w-40">
              <div className="bg-[#0a121c]/80 border border-[#2a3645] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats?.yearlyListens || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider">This Year</p>
              </div>
              <div className="bg-[#0a121c]/80 border border-[#2a3645] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats?.monthlyListens || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider">This Month</p>
              </div>
              <div className="bg-[#0a121c]/80 border border-[#2a3645] rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-stone-500">0</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider">To Listen</p>
              </div>
            </div>

            {/* INFORMACIÓN CENTRAL */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{profileData.full_name || profileData.username}</h1>
                {profileData.pronouns && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-[#7cc7e8] px-2 py-0.5 rounded border border-[#2a3645]">
                    {profileData.pronouns}
                  </span>
                )}
              </div>
              <p className="text-stone-400 text-sm mt-1">@{profileData.username}</p>
              <div className="flex justify-center md:justify-start gap-6 mt-3 text-sm">
                <span><strong className="text-white">{profileData.followers || 0}</strong> Followers</span>
                <span><strong className="text-white">{profileData.following || 0}</strong> Following</span>
              </div>
              {profileData.bio && (
                <p className="text-stone-300 text-sm mt-4 leading-relaxed border-l-2 border-[#2a3645] pl-4 max-w-md">
                  {profileData.bio}
                </p>
              )}
              {profileData.website && (
                <a
                  href={profileData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-xs text-[#7cc7e8] hover:underline bg-[#0a121c] px-3 py-1 rounded-full border border-[#2a3645]"
                >
                  {profileData.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {/* BOTÓN ACCIÓN (derecha) */}
            <div className="w-full md:w-auto flex justify-center md:justify-end">
              {isOwner ? (
                <button
                  onClick={() => router.push('/settings')}
                  className="bg-[#1f2b3a] hover:bg-[#2a3645] text-sm font-semibold px-5 py-2 rounded border border-[#2a3645] transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={actionLoading}
                  className={`text-sm font-semibold px-5 py-2 rounded border transition-colors ${
                    profileData.isFollowing
                      ? "bg-transparent border-[#2a3645] text-white hover:bg-red-900/30 hover:border-red-900/50"
                      : "bg-[#7cc7e8] text-[#0a121c] border-transparent hover:bg-white"
                  }`}
                >
                  {profileData.isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FAVORITOS CENTRADOS */}
      {profileData.favorite_albums?.length > 0 && (
        <section className="max-w-5xl mx-auto w-full px-4 md:px-8 mt-10">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4 text-center border-b border-[#2a3645] pb-2">
            Favorite Albums
          </h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            {profileData.favorite_albums.map((fav, idx) => (
              <a
                key={idx}
                href={`/album/${fav.id}`}
                className="block bg-[#131e2c] border border-[#2a3645] rounded-lg p-3 hover:border-[#7cc7e8]/30 transition-colors group"
              >
                <div className="aspect-square rounded overflow-hidden mb-2">
                  {fav.coverUrl ? (
                    <Image
                      src={fav.coverUrl}
                      alt={fav.title}
                      width={160}
                      height={160}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1f2b3a] flex items-center justify-center text-stone-600 text-xs">
                      No cover
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold truncate">{fav.title}</p>
                <p className="text-[10px] text-stone-400 truncate">{fav.artist}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* SECCIÓN DETALLADA CON TABS Y WIDGETS */}
      <section className="max-w-5xl mx-auto w-full px-4 md:px-8 mt-10 flex-1">
        {/* Tabs */}
        <div className="flex border-b border-[#2a3645] mb-6">
          <button
            onClick={() => setActiveTab("activity")}
            className={`pb-3 px-4 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === "activity" ? "border-[#7cc7e8] text-[#7cc7e8]" : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            Recent Activity
          </button>
          {/* Puedes añadir más tabs aquí en el futuro */}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Columna principal: Actividad (tab actual) */}
          <div className="flex-1">
            {activeTab === "activity" && (
              <ActivityFeed activities={stats?.recentActivity || []} />
            )}
          </div>

          {/* Columna lateral derecha: widgets siempre visibles */}
          <div className="w-full lg:w-72 space-y-6">
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 border-b border-[#2a3645] pb-2">
                Monthly Top
              </h3>
              <MonthlyTopWidget albums={stats?.monthlyTop || []} />
            </div>
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 border-b border-[#2a3645] pb-2">
                Rating Distribution
              </h3>
              <RatingChart distribution={stats?.ratingDistribution || {}} />
            </div>
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 border-b border-[#2a3645] pb-2">
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
