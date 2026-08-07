"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ErrorMessage } from "@/components/shared";

const PRONOUNS = [
  "He/him",
  "She/her",
  "They/them",
  "He/they",
  "She/they",
  "Xe/xyr",
  "Ze/hir",
  "It/its",
  "Any pronouns",
  "Prefer not to say",
];

const inputClass =
  "w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]";

export default function OnboardingPage() {
  const { user, loading, applyProfile, refreshUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [favoriteAlbums, setFavoriteAlbums] = useState([null, null, null]);

  const [activeSlot, setActiveSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (user.onboarding_completed === true) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getUserProfile(user.id);
        if (cancelled || !data) return;
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setBio(data.bio || "");
        setPronouns(data.pronouns || "");
        const slots = [null, null, null];
        if (Array.isArray(data.favorite_albums)) {
          data.favorite_albums.slice(0, 3).forEach((a, i) => {
            slots[i] = a;
          });
        }
        setFavoriteAlbums(slots);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be 2MB or smaller.");
      return;
    }
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", "tornamesa_avatars");
    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/ctgcewhd/image/upload",
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (data.secure_url) setAvatarUrl(data.secure_url);
      else setError("Could not upload image.");
    } catch {
      setError("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  };

  const handleBio = (e) => {
    const text = e.target.value;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 50 || text.length < bio.length) setBio(text);
  };

  const searchAlbums = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      setSearchResults((await api.searchAlbums(searchQuery)) || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickAlbum = (album) => {
    if (activeSlot === null) return;
    const next = [...favoriteAlbums];
    next[activeSlot] = {
      id: album.id,
      title: album.title,
      artist: album.artist,
      coverUrl: album.coverUrl,
    };
    setFavoriteAlbums(next);
    setActiveSlot(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const finish = async (markComplete = true) => {
    if (!user?.id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        full_name: fullName,
        avatar_url: avatarUrl,
        bio,
        pronouns,
        favorite_albums: favoriteAlbums.filter(Boolean),
        onboarding_completed: markComplete,
      };
      // keep username if we have it
      if (user.username) payload.username = user.username;

      const res = await api.updateUserProfile(user.id, payload);
      const saved = res?.data || { ...payload, onboarding_completed: true };

      applyProfile({
        ...saved,
        onboarding_completed: true,
      });
      try {
        await refreshUser();
      } catch {
        /* ignore */
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save. Try again.");
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
        Loading...
      </div>
    );
  }

  const wordCount = bio.trim()
    ? bio.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold mb-2">
          Step {step} of 3
        </p>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${
                n <= step ? "bg-[#7cc7e8]" : "bg-[#2a3645]"
              }`}
            />
          ))}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          {step === 1 && "How should we show you?"}
          {step === 2 && "A bit about your taste"}
          {step === 3 && "Pick a few favorites"}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          {step === 1 && "Photo and display name — all optional."}
          {step === 2 && "Bio and pronouns — skip anytime."}
          {step === 3 && "Up to 3 albums on your profile."}
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}

      <div className="bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl p-5 sm:p-6 space-y-5">
        {step === 1 && (
          <>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#2a3645] bg-[#1f2b3a] flex items-center justify-center font-bold text-lg shrink-0">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (user.username || "U").substring(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  disabled={uploading || saving}
                  className="text-xs text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1f2b3a] file:text-[#7cc7e8]"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  {uploading ? "Uploading..." : "JPG or PNG. Max 2MB."}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                Display name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="How you want to be shown"
                className={inputClass}
                disabled={saving}
              />
            </div>
            {user.username && (
              <p className="text-xs text-stone-500">
                Your profile URL:{" "}
                <span className="text-[#7cc7e8]">@{user.username}</span>
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                Pronouns
              </label>
              <select
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                className={inputClass}
                disabled={saving}
              >
                <option value="">Prefer not to say</option>
                {PRONOUNS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={handleBio}
                rows={3}
                placeholder="A few words about your music taste..."
                className={inputClass + " resize-none"}
                disabled={saving}
              />
              <p className="text-[10px] text-stone-500 mt-1 text-right">
                {wordCount} / 50 words
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="grid grid-cols-3 gap-3">
            {favoriteAlbums.map((album, idx) => (
              <div
                key={idx}
                onClick={() =>
                  !album && !saving && setActiveSlot(idx)
                }
                className={`relative group aspect-square bg-[#0a121c] border border-[#2a3645] rounded-xl overflow-hidden ${
                  !album ? "cursor-pointer hover:border-[#7cc7e8]/50" : ""
                }`}
              >
                {album ? (
                  <>
                    <Image
                      src={album.coverUrl}
                      alt={album.title}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = [...favoriteAlbums];
                        next[idx] = null;
                        setFavoriteAlbums(next);
                      }}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-500 text-xs">
                    + Add
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => finish(true)}
          disabled={saving}
          className="text-xs text-stone-500 hover:text-white order-2 sm:order-1"
        >
          Skip for now
        </button>
        <div className="flex gap-2 order-1 sm:order-2 justify-end">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
              className="px-4 py-2.5 text-sm rounded-lg border border-[#2a3645] text-stone-400 hover:text-white"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={saving || uploading}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0]"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => finish(true)}
              disabled={saving || uploading}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#7cc7e8] text-[#0a121c] hover:bg-[#a5d8f0] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Finish"}
            </button>
          )}
        </div>
      </div>

      {activeSlot !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131e2c] border border-[#2a3645] p-5 rounded-2xl w-full max-w-md">
            <h3 className="font-semibold mb-4">Select album</h3>
            <form onSubmit={searchAlbums} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Album or artist..."
                className={inputClass}
                autoFocus
              />
              <button
                type="submit"
                className="bg-[#7cc7e8] text-[#0a121c] px-3 py-2 text-xs font-semibold rounded-lg shrink-0"
              >
                {searching ? "..." : "Search"}
              </button>
            </form>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickAlbum(item)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-[#1f2b3a] rounded-lg text-left"
                >
                  {item.coverUrl && (
                    <Image
                      src={item.coverUrl}
                      alt={item.title}
                      width={40}
                      height={40}
                      className="w-10 h-10 object-cover rounded"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-stone-500 truncate">
                      {item.artist}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActiveSlot(null)}
              className="mt-4 w-full text-xs text-stone-500 py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
