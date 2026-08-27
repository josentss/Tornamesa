"use client";

import Image from "next/image";
import ProfileSocialLinks from "@/components/profile/ProfileSocialLinks";

/**
 * Profile header card (desktop + mobile).
 * Props are controlled by UserProfileClient.
 */
export default function ProfileHeaderCard({
  profileData,
  profileStats,
  displayName,
  isOwner,
  isPrivateLocked,
  actionLoading,
  shareCopied,
  onShare,
  onFollowToggle,
  onEditProfile,
}) {
  if (!profileData) return null;

  return (
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
                        sizes="128px"
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
                  {!isPrivateLocked && <ProfileSocialLinks profile={profileData} />}
                </div>

                {/* action btns - centrados vertical bien */}
                <div className="justify-self-end flex flex-col items-stretch gap-2 w-full max-w-[7.5rem]">
                  <button
                    type="button"
                    onClick={onShare}
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
                      onClick={onFollowToggle}
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
                {!isPrivateLocked && <ProfileSocialLinks profile={profileData} />}
              </div>

              {/* action btns en celular */}
              <div className="md:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={onShare}
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
                    onClick={onFollowToggle}
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
  );
}
