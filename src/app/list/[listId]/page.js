"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";

export default function ListDetailPage({ params }) {
  const rawId = typeof params?.then === "function" ? null : params?.listId;
  const [listId, setListId] = useState(rawId);
  const { user } = useAuth();
  const router = useRouter();

  const [list, setList] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setListId(p.listId));
    } else if (params?.listId) {
      setListId(params.listId);
    }
  }, [params]);

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getList(listId);
        if (cancelled) return;
        setList(data.list);
        setAlbums(data.albums || []);
        setEditName(data.list.name || "");
        setEditDescription(data.list.description || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load list");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const isOwner = user && list && user.id === list.userId;

  const handleRemove = async (albumId) => {
    if (!user || !isOwner) return;
    setRemovingId(albumId);
    try {
      await api.removeFromList(listId, albumId, user.id);
      setAlbums((prev) => prev.filter((a) => a.album.id !== albumId));
      setList((prev) =>
        prev ? { ...prev, count: Math.max(0, (prev.count || 0) - 1) } : prev
      );
      setToast({ message: "Removed from list", type: "success" });
    } catch (err) {
      setToast({ message: err.message || "Could not remove", type: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!user || !isOwner) return;
    setSavingEdit(true);
    try {
      const payload = { description: editDescription };
      if (!list.isSystem) payload.name = editName.trim();
      const res = await api.updateList(listId, user.id, payload);
      setList((prev) => ({
        ...prev,
        name: res.list.name,
        description: res.list.description,
      }));
      setEditing(false);
      setToast({ message: "List updated", type: "success" });
    } catch (err) {
      setToast({ message: err.message || "Could not update", type: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteList = async () => {
    if (!user || !isOwner || list.isSystem) return;
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteList(listId, user.id);
      setToast({ message: "List deleted", type: "success" });
      router.push(list.username ? `/${list.username}` : "/");
    } catch (err) {
      setToast({ message: err.message || "Could not delete", type: "error" });
      setDeleting(false);
    }
  };

  if (loading || !listId) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading list..." />
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
          <ErrorMessage message={error || "List not found"} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] overflow-x-hidden">
      <Header user={user} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {list.username && (
          <Link
            href={`/${list.username}`}
            className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
          >
            ← @{list.username}
          </Link>
        )}

        {!editing ? (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {list.name}
              </h1>
              {list.description ? (
                <p className="text-stone-400 text-sm mt-1">{list.description}</p>
              ) : isOwner ? (
                <p className="text-stone-600 text-sm mt-1 italic">No description</p>
              ) : null}
              <p className="text-xs text-stone-500 mt-2">
                {list.count} album{list.count !== 1 ? "s" : ""}
              </p>
            </div>
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#1f2b3a] border border-[#2a3645] hover:border-[#3d5068]"
                >
                  Edit
                </button>
                {!list.isSystem && (
                  <button
                    onClick={handleDeleteList}
                    disabled={deleting}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-950/30 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveEdit} className="mt-4 space-y-3 max-w-md">
            {!list.isSystem && (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="List name"
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
              />
            )}
            {list.isSystem && (
              <p className="text-sm font-semibold text-white">{list.name}</p>
            )}
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#7cc7e8]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingEdit}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditName(list.name);
                  setEditDescription(list.description || "");
                }}
                className="text-sm px-4 py-2 rounded-lg text-stone-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {albums.length === 0 ? (
          <div className="mt-10 py-12 text-center bg-[#131e2c]/50 border border-[#2a3645] rounded-xl">
            <p className="text-stone-400 text-sm">This list is empty</p>
            {isOwner && (
              <Link
                href="/search"
                className="text-[#7cc7e8] text-xs font-semibold hover:underline mt-2 inline-block"
              >
                Find albums to add
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {albums.map((item) => (
              <div key={item.itemId || item.album.id} className="group relative min-w-0">
                <Link href={`/album/${item.album.id}`}>
                  <div className="aspect-square rounded-xl overflow-hidden bg-[#1f2b3a] border border-[#2a3645] group-hover:border-[#7cc7e8]/40 transition-colors">
                    {item.album.cover ? (
                      <Image
                        src={item.album.cover}
                        alt={item.album.title}
                        width={200}
                        height={200}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : null}
                  </div>
                  <p className="text-xs font-semibold mt-2 truncate group-hover:text-[#7cc7e8] transition-colors">
                    {item.album.title}
                  </p>
                  <p className="text-[10px] text-stone-500 truncate">
                    {item.album.artist}
                  </p>
                </Link>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(item.album.id)}
                    disabled={removingId === item.album.id}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-[#2a3645] text-stone-300 hover:text-red-400 hover:border-red-800 text-sm flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Remove from list"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
