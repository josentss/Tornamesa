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

      {/* ========== PROFILE HEADER ========== */}
      <div className="relative w-full max-w-5xl mx-auto px-4 md:px-8 mt-16">
        {/* Tarjeta de perfil */}
        <div className="relative bg-[#131e2c] border border-[#2a3645] rounded-2xl pt-16 pb-8 px-6 md:px-8 shadow-2xl">

          {/* Avatar semi-incrustado */}
          <div className="absolute -top-14 left-1/2 -translate-x-1/2">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-[#131e2c] bg-[#0a121c] overflow-hidden shadow-xl ring-2 ring-[#7cc7e8]/40">
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
          </div>

          {/* Contenido de la tarjeta */}
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8 mt-4">

            {/* IZQUIERDA: Stats principales */}
            <div className="w-full md:w-36 flex-shrink-0 order-2 md:order-1">
              <div className="space-y-3 text-center md:text-left">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.yearlyListens || 0}</p>
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider">Este año</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.monthlyListens || 0}</p>
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider">Este mes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-[11px] text-stone-400 uppercase tracking-wider">Por escuchar</p>
                </div>
              </div>
            </div>

            {/* CENTRO: Info del usuario */}
            <div className="flex-1 text-center order-1 md:order-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {profileData.full_name || profileData.username}
                </h1>
                {profileData.pronouns && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#1f2b3a] text-[#7cc7e8] px-2 py-0.5 rounded border border-[#2a3645]">
                    {profileData.pronouns}
                  </span>
                )}
              </div>

              <p className="text-stone-400 text-sm mt-1">@{profileData.username}</p>

              <div className="flex justify-center gap-6 mt-3 text-sm">
                <span>
                  <strong className="text-white">{profileData.followers || 0}</strong>{" "}
                  <span className="text-stone-400">Followers</span>
                </span>
                <span>
                  <strong className="text-white">{profileData.following || 0}</strong>{" "}
                  <span className="text-stone-400">Following</span>
                </span>
              </div>

              {profileData.bio && (
                <p className="text-stone-300 text-sm mt-4 leading-relaxed max-w-md mx-auto">
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
                  {profileData.website.replace(/^https?:\/\//, "")}
                </a>
              )}

              {/* Now Playing */}
              {profileData.nowPlaying?.isPlaying && (
                <a
                  href={profileData.nowPlaying.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-[#0a121c] border border-[#2a3645] hover:border-[#1db954] transition-colors rounded-full px-4 py-2 mt-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1db954]">
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                    <circle cx="8" cy="12" r="2" />
                    <circle cx="16" cy="12" r="2" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase tracking-wider text-[#1db954] font-bold leading-none mb-0.5">
                      Listening now
                    </span>
                    <span className="text-sm font-bold text-[#f0f9ff] leading-none truncate max-w-[180px]">
                      {profileData.nowPlaying.title}
                    </span>
                    <span className="text-xs text-stone-400 leading-none mt-0.5 truncate max-w-[180px]">
                      {profileData.nowPlaying.artist}
                    </span>
                  </div>
                </a>
              )}
            </div>

            {/* DERECHA: Botón de acción */}
            <div className="w-full md:w-36 flex-shrink-0 flex justify-center md:justify-end order-3">
              {isOwner ? (
                <button
                  onClick={() => router.push("/settings")}
                  className="bg-[#1f2b3a] hover:bg-[#2a3645] text-sm font-semibold px-5 py-2.5 rounded-lg border border-[#2a3645] transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={actionLoading}
                  className={`text-sm font-semibold px-5 py-2.5 rounded-lg border transition-colors ${
                    profileData.isFollowing
                      ? "bg-transparent border-[#2a3645] text-white hover:bg-red-900/20 hover:border-red-800/50"
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

      {/* ========== FAVORITE ALBUMS ========== */}
      {profileData.favorite_albums?.length > 0 && (
        <section className="max-w-5xl mx-auto w-full px-4 md:px-8 mt-10">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-5 text-center">
            Favorite Albums
          </h2>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {profileData.favorite_albums.map((fav, idx) => (
              <a
                key={idx}
                href={`/album/${fav.id}`}
                className="block group"
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-2 border border-[#2a3645] group-hover:border-[#7cc7e8]/40 transition-colors">
                  {fav.coverUrl ? (
                    <Image
                      src={fav.coverUrl}
                      alt={fav.title}
                      width={140}
                      height={140}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1f2b3a] flex items-center justify-center text-stone-600 text-xs">
                      No cover
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium truncate text-center">{fav.title}</p>
                <p className="text-[10px] text-stone-500 truncate text-center">{fav.artist}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ========== SECCIÓN DETALLADA ========== */}
      <section className="max-w-5xl mx-auto w-full px-4 md:px-8 mt-12 flex-1 pb-16">
        {/* Tabs */}
        <div className="flex border-b border-[#2a3645] mb-6">
          <button
            onClick={() => setActiveTab("activity")}
            className={`pb-3 px-5 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === "activity"
                ? "border-[#7cc7e8] text-[#7cc7e8]"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            Recent Activity
          </button>
          {/* Aquí puedes agregar más tabs en el futuro */}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Columna principal */}
          <div className="flex-1 min-w-0">
            {activeTab === "activity" && (
              <ActivityFeed activities={stats?.recentActivity || []} />
            )}
          </div>

          {/* Sidebar derecha */}
          <div className="w-full lg:w-72 space-y-5 flex-shrink-0">
            {/* Monthly Top */}
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 pb-2 border-b border-[#2a3645]">
                Monthly Top
              </h3>
              <MonthlyTopWidget albums={stats?.monthlyTop || []} />
            </div>

            {/* Rating Distribution */}
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 pb-2 border-b border-[#2a3645]">
                Rating Distribution
              </h3>
              <RatingChart distribution={stats?.ratingDistribution || {}} />
            </div>

            {/* Lists */}
            <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-5">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 pb-2 border-b border-[#2a3645]">
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
