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

const inputClass =
  "w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors disabled:opacity-50";
const labelClass =
  "block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5";
const sectionClass =
  "bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl p-5 sm:p-6 space-y-4";

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
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

    const apply = (data) => {
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
    };

    const load = async () => {
      setLoading(true);
      setError("");

      // Seed from session
      if (user.username) setUsername(user.username);
      if (user.avatar_url) setAvatarUrl(user.avatar_url);

      try {
        let data = await api.getUserProfile(user.id);

        const looksEmpty =
          data &&
          !data.username &&
          !data.full_name &&
          !data.bio &&
          !data.avatar_url &&
          !(data.favorite_albums && data.favorite_albums.length);

        // Fallback: public endpoint by username (works if profile exists by name)
        if (looksEmpty) {
          const uname =
            user.username || user.user_metadata?.username || null;
          if (uname) {
            try {
              const pub = await api.getPublicProfile(uname);
              if (pub?.profile) data = pub.profile;
            } catch {
              /* ignore */
            }
          }
        }

        apply(data);
      } catch (err) {
        console.error("Load profile:", err);
        setError("Could not load profile data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.avatar_url, user?.user_metadata?.username]);

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
      const results = await api.searchAlbums(searchQuery);
      setSearchResults(results || []);
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

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!/^[a-z0-9_-]{3,20}$/.test(username.toLowerCase())) {
      setError(
        "Username must be 3–20 characters (letters, numbers, _ or -)."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateUserProfile(user.id, {
        username: username.toLowerCase(),
        full_name: fullName,
        avatar_url: avatarUrl,
        pronouns,
        website,
        bio,
        favorite_albums: favoriteAlbums.filter(Boolean),
      });

      // Prefer server-returned row
      if (res?.data) {
        setUsername(res.data.username || username);
        setFullName(res.data.full_name || "");
        setAvatarUrl(res.data.avatar_url || "");
        setPronouns(res.data.pronouns || "");
        setWebsite(res.data.website || "");
        setBio(res.data.bio || "");
      }

      if (typeof refreshUser === "function") {
        await refreshUser();
      }

      setSuccess("Profile updated successfully.");
      setSaving(false);

      setTimeout(() => {
        router.push(`/${(res?.data?.username || username).toLowerCase()}`);
        router.refresh();
      }, 800);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save changes.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 bg-[#131e2c] rounded-2xl border border-[#2a3645]" />
        <div className="h-40 bg-[#131e2c] rounded-2xl border border-[#2a3645]" />
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">Profile photo</h2>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#2a3645] bg-[#1f2b3a] flex items-center justify-center font-bold text-lg shrink-0 relative">
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
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                disabled={saving || uploadingImage}
                className="text-xs text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1f2b3a] file:text-[#7cc7e8] hover:file:bg-[#2a3645] cursor-pointer"
              />
              <p className="text-[10px] text-stone-500 mt-1.5">
                {uploadingImage ? "Uploading..." : "JPG or PNG. Max 2MB."}
              </p>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">Identity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass + " mb-0"}>Username</label>
                <button
                  type="button"
                  onClick={() => setIsEditingUsername((v) => !v)}
                  className="text-[11px] text-[#7cc7e8] hover:underline"
                >
                  {isEditingUsername ? "Lock" : "Edit"}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                  }
                  disabled={!isEditingUsername || saving || uploadingImage}
                  className={inputClass + " pl-7"}
                  placeholder="username"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Display name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving || uploadingImage}
                className={inputClass}
                placeholder="How you want to be shown"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Pronouns</label>
            <select
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              disabled={saving || uploadingImage}
              className={inputClass}
            >
              <option value="">Prefer not to say</option>
              {PRONOUNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">About</h2>
          <div>
            <label className={labelClass}>Bio</label>
            <textarea
              value={bio}
              onChange={handleBioChange}
              rows={3}
              disabled={saving || uploadingImage}
              className={inputClass + " resize-none"}
              placeholder="A few words about your taste in music..."
            />
            <p className="text-[10px] text-stone-500 mt-1 text-right">
              {wordCount} / 50 words
            </p>
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={saving || uploadingImage}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">Favorite albums</h2>
          <p className="text-xs text-stone-500">Up to 3 on your profile</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {favoriteAlbums.map((album, idx) => (
              <div
                key={idx}
                onClick={() =>
                  !album && !saving && !uploadingImage && setActiveSlot(idx)
                }
                className={`relative group aspect-square bg-[#0a121c] border border-[#2a3645] rounded-xl flex items-center justify-center overflow-hidden ${
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
                      className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="text-stone-500 text-xs">+ Add</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="bg-[#7cc7e8] text-[#0a121c] px-6 py-2.5 text-sm font-semibold rounded-lg hover:bg-[#a5d8f0] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving || uploadingImage}
            className="border border-[#2a3645] text-stone-400 px-6 py-2.5 text-sm rounded-lg hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>

      {activeSlot !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131e2c] border border-[#2a3645] p-5 rounded-2xl w-full max-w-md">
            <h3 className="font-semibold mb-4">Select favorite album</h3>
            <form onSubmit={handleSearchAlbum} className="flex gap-2 mb-4">
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
                className="bg-[#7cc7e8] text-[#0a121c] px-3 py-2 text-xs font-semibold rounded-lg"
              >
                {searching ? "..." : "Search"}
              </button>
            </form>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectFavoriteAlbum(item)}
                  className="w-full flex items-center gap-3 p-2 bg-[#0a121c] hover:bg-[#1f2b3a] rounded-lg text-left"
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
              className="mt-4 w-full text-xs text-stone-500 hover:text-white py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
