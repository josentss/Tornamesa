"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LoadingSpinner,
  ErrorMessage,
  SuccessMessage,
} from "@/components/shared";

const PRONOUNS = [
  "He/his",
  "He/their",
  "She/her",
  "She/their",
  "They/their",
  "Xe/xyr",
  "Ze/hir",
  "Ze/zit",
  "It/its",
];

export default function ProfilePage() {
  const { user } = useAuth();
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
    let timeoutId;

    if (!user?.id) {
      timeoutId = setTimeout(() => {
        if (!user?.id) router.push("/");
      }, 1500);
      return () => clearTimeout(timeoutId);
    }

    const loadProfile = async () => {
      try {
        const data = await api.getUserProfile(user.id);
        if (data) {
          setUsername(data.username || "");
          setFullName(data.full_name || "");
          setAvatarUrl(data.avatar_url || "");
          setPronouns(data.pronouns || "");
          setWebsite(data.website || "");
          setBio(data.bio || "");

          if (Array.isArray(data.favorite_albums)) {
            const slots = [null, null, null];
            data.favorite_albums.slice(0, 3).forEach((item, idx) => {
              slots[idx] = item;
            });
            setFavoriteAlbums(slots);
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Could not load profile data.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
    return () => clearTimeout(timeoutId);
  }, [user?.id, router]);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must not exceed 2MB.");
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
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data.secure_url) {
        setAvatarUrl(data.secure_url);
      } else {
        setError("A problem occurred while uploading the image.");
      }
    } catch (err) {
      console.error("Error uploading to Cloudinary:", err);
      setError("Network error while trying to upload the photo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleBioChange = (e) => {
    const text = e.target.value;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 50 || text.length < bio.length) {
      setBio(text);
    }
  };

  const handleSearchAlbum = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.searchAlbums(searchQuery);
      setSearchResults(results || []);
    } catch (err) {
      console.error("Error searching albums:", err);
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
        "Username must be 3-20 characters (letters, numbers, _ or -)."
      );
      return;
    }

    setSaving(true);
    try {
      await api.updateUserProfile(user.id, {
        username: username.toLowerCase(),
        full_name: fullName,
        avatar_url: avatarUrl,
        pronouns,
        website,
        bio,
        favorite_albums: favoriteAlbums.filter(Boolean),
      });

      setSuccess("Profile updated successfully!");

      setTimeout(() => {
        router.push(`/${username.toLowerCase()}`);
      }, 1000);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Error saving changes.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <LoadingSpinner message="Loading settings..." />
      </div>
    );
  }

  return (
    <>
      {error && <ErrorMessage message={error} onDismiss={() => setError("")} />}
      {success && <SuccessMessage message={success} />}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-[#131b26] p-6 rounded-lg border border-[#1e293b]"
      >
        {/* Avatar */}
        <div className="flex items-center gap-6 pb-6 border-b border-[#1e293b]">
          <div className="w-20 h-20 bg-[#1e293b] rounded-full overflow-hidden border-2 border-[#87ceeb] flex items-center justify-center font-bold text-xl shrink-0 relative">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar Preview"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              (username || "U").substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <label className="text-xs text-[#87ceeb] font-bold mb-2 block">
              Profile Picture
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              disabled={saving || uploadingImage}
              className="text-xs text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1e293b] file:text-[#87ceeb] hover:file:bg-[#28384f] cursor-pointer"
            />
            {uploadingImage ? (
              <p className="text-[10px] text-[#87ceeb] mt-1 font-bold animate-pulse">
                Uploading image to cloud...
              </p>
            ) : (
              <p className="text-[10px] text-stone-500 mt-1">
                JPG or PNG format. Max 2MB.
              </p>
            )}
          </div>
        </div>

        {/* Username + Display Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#87ceeb] font-bold">
                Username (@)
              </label>
              <button
                type="button"
                onClick={() => setIsEditingUsername(!isEditingUsername)}
                className="text-stone-400 hover:text-[#87ceeb] transition-colors"
                title="Change Username"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="username"
              disabled={!isEditingUsername || saving || uploadingImage}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white focus:outline-none focus:border-[#87ceeb] disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs text-[#87ceeb] font-bold mb-2 block">
              Display Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name or nickname"
              disabled={saving || uploadingImage}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white focus:outline-none focus:border-[#87ceeb]"
            />
          </div>
        </div>

        {/* Pronouns */}
        <div>
          <label className="text-xs text-[#87ceeb] font-bold mb-2 block">
            Pronouns
          </label>
          <select
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white focus:outline-none focus:border-[#87ceeb]"
          >
            <option value="">Select pronouns...</option>
            {PRONOUNS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs text-[#87ceeb] font-bold mb-2 block">
            Bio (Max 50 words)
          </label>
          <textarea
            value={bio}
            onChange={handleBioChange}
            placeholder="Write something about your musical taste..."
            rows={3}
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white resize-none focus:outline-none focus:border-[#87ceeb]"
          />
          <p className="text-xs text-stone-500 mt-1 text-right">
            {bio.trim()
              ? bio.trim().split(/\s+/).filter(Boolean).length
              : 0}{" "}
            / 50 words
          </p>
        </div>

        {/* Website */}
        <div>
          <label className="text-xs text-[#87ceeb] font-bold mb-2 block">
            Personal Link / Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://your-site.com"
            disabled={saving || uploadingImage}
            className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white focus:outline-none focus:border-[#87ceeb]"
          />
        </div>

        {/* Favorite Albums */}
        <div className="pt-4 border-t border-[#1e293b]">
          <label className="text-xs text-[#87ceeb] font-bold mb-3 block">
            3 Favorite Albums
          </label>
          <div className="grid grid-cols-3 gap-4">
            {favoriteAlbums.map((album, idx) => (
              <div
                key={idx}
                onClick={() =>
                  !album && !saving && !uploadingImage && setActiveSlot(idx)
                }
                className={`relative group aspect-square bg-[#0a0f16] border border-[#1e293b] rounded flex items-center justify-center overflow-hidden transition-colors ${
                  !album ? "cursor-pointer hover:border-[#87ceeb]" : ""
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
                      className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={saving || uploadingImage}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="text-stone-500 text-xs group-hover:text-[#87ceeb] flex flex-col items-center gap-1">
                    <span className="text-xl">+</span>
                    <span>Slot {idx + 1}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-[#1e293b]">
          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="bg-[#87ceeb] text-[#0a0f16] px-6 py-2 font-bold hover:bg-white disabled:opacity-50 rounded transition-all"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving || uploadingImage}
            className="border border-[#1e293b] text-stone-400 px-6 py-2 hover:border-[#87ceeb] hover:text-[#87ceeb] rounded transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Modal búsqueda álbum favorito */}
      {activeSlot !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b26] border border-[#1e293b] p-6 rounded-lg w-full max-w-md">
            <h3 className="font-bold mb-4 text-[#87ceeb]">
              Select Favorite Album
            </h3>
            <form onSubmit={handleSearchAlbum} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Album or artist name..."
                className="flex-1 bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#87ceeb]"
                autoFocus
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-[#87ceeb] text-[#0a0f16] px-3 py-2 text-xs font-bold rounded"
              >
                {searching ? "..." : "Search"}
              </button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => selectFavoriteAlbum(item)}
                  className="flex items-center gap-3 p-2 bg-[#0a0f16] hover:bg-[#1e293b] rounded cursor-pointer transition-colors"
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
                  <div className="overflow-hidden text-left">
                    <p className="text-xs font-bold truncate">{item.title}</p>
                    <p className="text-[10px] text-stone-400 truncate">
                      {item.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveSlot(null)}
              className="mt-4 w-full text-center text-xs text-stone-400 hover:text-white py-1 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
