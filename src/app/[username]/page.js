"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";

export default function UserProfilePage({ params }) {
  // Next.js 15+: params puede ser un Promise
  const username = typeof params?.then === "function" ? null : params?.username;
  const [resolvedUsername, setResolvedUsername] = useState(username);

  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [listens, setListens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Resolver params si es Promise (Next.js 15+)
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

        const data = await api.getPublicProfile(
          resolvedUsername,
          currentUser?.id
        );

        if (cancelled) return;

        setProfileData(data.profile);
        setListens(data.listens || []);
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
    currentUser &&
    profileData &&
    (currentUser.id === profileData.id ||
      currentUser.username === profileData.username);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }

    setActionLoading(true);
    try {
      if (profileData.isFollowing) {
        await api.unfollowUser(currentUser.id, profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: false,
          followers: Math.max(0, (prev.followers || 0) - 1),
        }));
      } else {
        await api.followUser(currentUser.id, profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: true,
          followers: (prev.followers || 0) + 1,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Cálculos derivados
  const totalListens = listens.length;
  const ratingsList = listens.filter((l) => l.rating).map((l) => l.rating);
  const avgRating =
    ratingsList.length > 0
      ? (ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length).toFixed(1)
      : "N/A";

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingsList.forEach((r) => {
    if (ratingCounts[r] !== undefined) ratingCounts[r]++;
  });

  const albumCounts = {};
  listens.forEach((item) => {
    if (item.album_title) {
      albumCounts[item.album_title] = {
        count: (albumCounts[item.album_title]?.count || 0) + 1,
        cover: item.album_cover,
        artist: item.artist_name,
      };
    }
  });

  const topMonthly = Object.entries(albumCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  // Loading
  if (loading || !resolvedUsername) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={currentUser} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading profile..." />
        </div>
      </div>
    );
  }

  // Error
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-8 space-y-10">
        {/* Header del perfil */}
        <div className="bg-[#131b26] border border-[#1e293b] rounded-xl p-8 flex flex-col md:flex-row items-start justify-between gap-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#87ceeb] opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10 w-full">
            <div className="w-28 h-28 bg-[#0a0f16] rounded-full overflow-hidden border-2 border-[#87ceeb] shadow-[0_0_15px_rgba(135,206,235,0.15)] flex items-center justify-center text-4xl font-bold shrink-0 relative">
              {profileData.avatar_url ? (
                <Image
                  src={profileData.avatar_url}
                  alt={profileData.username}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              ) : (
                profileData.username.substring(0, 2).toUpperCase()
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">
                  {profileData.full_name || profileData.username}
                </h1>
                {profileData.pronouns && (
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-[#1e293b] text-[#87ceeb] px-2 py-1 rounded border border-[#334155]">
                    {profileData.pronouns}
                  </span>
                )}
              </div>

              <p className="text-stone-400 text-sm font-medium">
                @{profileData.username}
              </p>

              <div className="flex gap-4 text-sm font-bold text-stone-300 mt-2">
                <div>
                  <span className="text-white">{profileData.followers || 0}</span>{" "}
                  Followers
                </div>
                <div>
                  <span className="text-white">{profileData.following || 0}</span>{" "}
                  Following
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-stone-400 pt-2">
                {profileData.country && (
                  <span className="flex items-center gap-1.5 bg-[#0a0f16] px-3 py-1 rounded-full border border-[#1e293b]">
                    📍 {profileData.country}
                  </span>
                )}
                {profileData.website && (
                  <a
                    href={profileData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#0a0f16] px-3 py-1 rounded-full border border-[#1e293b] text-[#87ceeb] hover:border-[#87ceeb]/50 transition-colors"
                  >
                    🔗 {profileData.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>

              {profileData.bio && (
                <p className="text-stone-300 text-sm mt-4 max-w-2xl leading-relaxed border-l-2 border-[#1e293b] pl-4">
                  {profileData.bio}
                </p>
              )}

              {/* Now Playing */}
              {profileData.nowPlaying?.isPlaying && (
                <a
                  href={profileData.nowPlaying.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-[#0a0f16] border border-[#1e293b] hover:border-[#1db954] transition-colors rounded-full px-4 py-2 mt-4 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#1db954]"
                  >
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                    <circle cx="8" cy="12" r="2" />
                    <circle cx="16" cy="12" r="2" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[#1db954] font-bold leading-none mb-1">
                      Escuchando ahora
                    </span>
                    <span className="text-sm font-bold text-[#f0f9ff] leading-none truncate max-w-[200px]">
                      {profileData.nowPlaying.title}
                    </span>
                    <span className="text-xs text-stone-400 leading-none mt-1 truncate max-w-[200px]">
                      {profileData.nowPlaying.artist}
                    </span>
                  </div>
                </a>
              )}
            </div>

            <div className="shrink-0 relative z-10">
              {isOwner ? (
                <button
                  onClick={() => router.push("/settings")}
                  className="bg-[#1e293b] hover:bg-[#28384f] text-xs font-semibold px-5 py-2.5 rounded transition-colors border border-[#334155]"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  disabled={actionLoading}
                  className={`text-xs font-semibold px-5 py-2.5 rounded transition-colors border ${
                    profileData.isFollowing
                      ? "bg-[#1e293b] text-white border-[#334155] hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/50"
                      : "bg-[#f0f9ff] text-[#0a0f16] border-transparent hover:bg-white"
                  }`}
                >
                  {profileData.isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Favorite Albums */}
        {profileData.favorite_albums?.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4 border-l-2 border-[#87ceeb] pl-3">
              Favorite Albums
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {profileData.favorite_albums.map((fav, index) => (
                <div
                  key={index}
                  className="bg-[#131b26] border border-[#1e293b] p-3 rounded-lg flex flex-col items-center text-center hover:border-[#87ceeb]/30 transition-colors group"
                >
                  <Image
                    src={fav.coverUrl}
                    alt={fav.title}
                    width={300}
                    height={300}
                    className="w-full aspect-square object-cover rounded shadow-md mb-3 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-shadow"
                  />
                  <p className="text-xs font-bold truncate w-full text-[#f0f9ff]">
                    {fav.title}
                  </p>
                  <p className="text-[10px] text-stone-400 truncate w-full mt-0.5">
                    {fav.artist}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider border-l-2 border-[#87ceeb] pl-3 mb-4">
              Recent Activity ({totalListens})
            </h2>

            {listens.length === 0 ? (
              <p className="text-stone-400 text-sm py-12 text-center bg-[#131b26]/40 rounded-xl border border-[#1e293b]/50">
                No listening history yet.
              </p>
            ) : (
              <div className="space-y-3">
                {listens.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#131b26] border border-[#1e293b] p-4 rounded-lg flex gap-4 items-center hover:bg-[#1a2433] transition-colors"
                  >
                    {item.album_cover && (
                      <Image
                        src={item.album_cover}
                        alt={item.album_title}
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover rounded shadow-sm shrink-0"
                      />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-[#f0f9ff] truncate">
                            {item.album_title}
                          </h3>
                          <p className="text-xs text-stone-400 truncate mt-0.5">
                            {item.artist_name}
                          </p>
                        </div>
                        {item.rating && (
                          <span className="text-[11px] bg-[#0a0f16] text-[#87ceeb] border border-[#87ceeb]/30 px-2 py-1 rounded font-bold shrink-0">
                            ★ {item.rating}/5
                          </span>
                        )}
                      </div>
                      {item.review && (
                        <p className="text-xs text-stone-300 mt-3 line-clamp-2 italic bg-[#0a0f16]/50 p-2 rounded border border-[#1e293b]/50">
                          "{item.review}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Monthly Top */}
            <div className="bg-[#131b26] border border-[#1e293b] p-6 rounded-xl space-y-5">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider border-b border-[#1e293b] pb-3">
                Monthly Top
              </h3>
              {topMonthly.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">
                  No data this month.
                </p>
              ) : (
                <div className="space-y-4">
                  {topMonthly.map(([title, info], i) => (
                    <div key={title} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#87ceeb] w-4">
                        {i + 1}
                      </span>
                      {info.cover && (
                        <Image
                          src={info.cover}
                          alt={title}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-cover rounded shadow-sm"
                        />
                      )}
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-[#f0f9ff] truncate">
                          {title}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {info.count} play{info.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ratings */}
            <div className="bg-[#131b26] border border-[#1e293b] p-6 rounded-xl space-y-5">
              <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Ratings
                </h3>
                <span className="text-[10px] text-stone-400 font-bold bg-[#0a0f16] px-2 py-1 rounded border border-[#1e293b]">
                  AVG: <span className="text-[#87ceeb] ml-1">{avgRating}</span>
                </span>
              </div>

              <div className="space-y-2.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingCounts[star];
                  const percentage =
                    ratingsList.length > 0
                      ? (count / ratingsList.length) * 100
                      : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-8 text-stone-400 font-medium">
                        {star} ★
                      </span>
                      <div className="flex-1 bg-[#0a0f16] h-2.5 rounded-full overflow-hidden border border-[#1e293b]">
                        <div
                          className="bg-[#87ceeb] h-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-stone-500 text-[10px] font-mono">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
