"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ErrorMessage, SuccessMessage } from "@/components/shared";

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

export default function ProfileSettingsPage() {
  const { user, refreshUser, applyProfile } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteAlbums, setFavoriteAlbums] = useState([null, null, null]);

  const [activeSlot, setActiveSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await api.getUserProfile(user.id);
        if (cancelled || !data) return;

        setUsername(data.username || "");
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setPronouns(data.pronouns || "");
        setWebsite(data.website || "");
        setBio(data.bio || "");

        const slots = [null, null, null];
        if (Array.isArray(data.favorite_albums)) {
          data.favorite_albums.slice(0, 3).forEach((item, i) => {
            slots[i] = item;
          });
        }
        setFavoriteAlbums(slots);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load profile data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be 2MB or smaller.");
      return;
    }
    setUploadingImage(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "tornamesa_avatars");
    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/ctgcewhd/image/upload",
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.secure_url) setAvatarUrl(data.secure_url);
      else setError("Could not upload the image.");
    } catch {
      setError("Network error while uploading.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleBioChange = (e) => {
    const text = e.target.value;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 50 || text.length < bio.length) setBio(text);
  };

  const handleSearchAlbum = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      setSearchResults((await api.searchAlbums(searchQuery)) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const selectFavoriteAlbum = (album) => {
    if (activeSlot === null) return;
    const updated = [...favoriteAlbums];
    updated[activeSlot] = {
      id: album.id,
      title: album.title,
      artist: album.artist,
      coverUrl: album.coverUrl,
    };
    setFavoriteAlbums(updated);
    setActiveSlot(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeFavoriteAlbum = (e, index) => {
    e.stopPropagation();
    const updated = [...favoriteAlbums];
    updated[index] = null;
    setFavoriteAlbums(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError("Username is required.");
      return;
    }
    if (!/^[a-z0-9_-]{3,20}$/.test(cleanUser)) {
      setError(
        "Username must be 3–20 characters (letters, numbers, _ or -)."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateUserProfile(user.id, {
        username: cleanUser,
        full_name: fullName,
        avatar_url: avatarUrl,
        pronouns,
        website,
        bio,
        favorite_albums: favoriteAlbums.filter(Boolean),
      });

      const saved = res?.data || {
        username: cleanUser,
        full_name: fullName,
        avatar_url: avatarUrl,
        pronouns,
        website,
        bio,
        favorite_albums: favoriteAlbums.filter(Boolean),
      };

      // 1) Update context immediately (Header + dashboard)
      if (typeof applyProfile === "function") {
        applyProfile(saved);
      }

      // 2) Re-fetch profile into context
      if (typeof refreshUser === "function") {
        await refreshUser();
      }

      // 3) Keep auth metadata in sync (avoids old username in JWT metadata)
      try {
        const { createClient } = await import("@/lib/supabase/client");
        await createClient().auth.updateUser({
          data: { username: cleanUser },
        });
      } catch {
        /* non-fatal */
      }

      setSuccess("Profile updated successfully.");
      setSaving(false);

      setTimeout(() => {
        router.push(`/${cleanUser}`);
        router.refresh();
      }, 600);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save changes.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-stone-500">
        Loading profile...
      </div>
    );
  }

  const wordCount = bio.trim()
    ? bio.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <>
      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        </div>
      )}
      {success && (
        <div className="mb-4">
          <SuccessMessage message={success} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-[#131e2c] p-5 sm:p-6 rounded-2xl border border-[#2a3645]"
      >
        <div className="flex items-center gap-5 pb-5 border-b border-[#2a3645]">
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
              (username || "U").substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <label className="text-xs text-[#7cc7e8] font-semibold mb-2 block">
              Profile picture
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              disabled={saving || uploadingImage}
              className="text-xs text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1f2b3a] file:text-[#7cc7e8]"
            />
            <p className="text-[10px] text-stone-500 mt-1">
              {uploadingImage ? "Uploading..." : "JPG or PNG. Max 2MB."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#7cc7e8] font-semibold">
                Username
              </label>
              <button
                type="button"
                onClick={() => setIsEditingUsername((v) => !v)}
                className="text-[11px] text-[#7cc7e8] hover:underline"
              >
                {isEditingUsername ? "Lock" : "Edit"}
              </button>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
              }
              disabled={!isEditingUsername || saving || uploadingImage}
              className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white disabled:opacity-50"
              placeholder="username"
            />
          </div>
          <div>
            <label className="text-xs text-[#7cc7e8] font-semibold mb-1.5 block">
              Display name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={saving || uploadingImage}
              className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white"
              placeholder="Display name"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-[#7cc7e8] font-semibold mb-1.5 block">
            Pronouns
          </label>
          <select
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white"
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
          <label className="text-xs text-[#7cc7e8] font-semibold mb-1.5 block">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={handleBioChange}
            rows={3}
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white resize-none"
            placeholder="About your music taste..."
          />
          <p className="text-[10px] text-stone-500 mt-1 text-right">
            {wordCount} / 50 words
          </p>
        </div>

        <div>
          <label className="text-xs text-[#7cc7e8] font-semibold mb-1.5 block">
            Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white"
            placeholder="https://..."
          />
        </div>

        <div className="pt-2 border-t border-[#2a3645]">
          <label className="text-xs text-[#7cc7e8] font-semibold mb-3 block">
            Favorite albums
          </label>
          <div className="grid grid-cols-3 gap-3">
            {favoriteAlbums.map((album, idx) => (
              <div
                key={idx}
                onClick={() =>
                  !album && !saving && !uploadingImage && setActiveSlot(idx)
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
                      onClick={(e) => removeFavoriteAlbum(e, idx)}
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
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="bg-[#7cc7e8] text-[#0a121c] px-6 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="border border-[#2a3645] text-stone-400 px-6 py-2.5 text-sm rounded-lg"
          >
            Cancel
          </button>
        </div>
      </form>

      {activeSlot !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#131e2c] border border-[#2a3645] p-5 rounded-2xl w-full max-w-md">
            <h3 className="font-semibold mb-4">Select favorite album</h3>
            <form onSubmit={handleSearchAlbum} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Album or artist..."
                className="flex-1 bg-[#0a121c] border border-[#2a3645] rounded-lg p-2 text-sm"
                autoFocus
              />
              <button
                type="submit"
                className="bg-[#7cc7e8] text-[#0a121c] px-3 py-2 text-xs font-semibold rounded-lg"
              >
                {searching ? "..." : "Search"}
              </button>
            </form>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectFavoriteAlbum(item)}
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
    </>
  );
}
