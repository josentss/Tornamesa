"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function SaveToListModal({
  open,
  onClose,
  userId,
  albumId,
  onToast,
}) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !userId || !albumId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getUserListsForAlbum(userId, albumId);
        if (!cancelled) setLists(data.lists || []);
      } catch (err) {
        console.error(err);
        onToast?.({ message: "Could not load lists", type: "error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, userId, albumId]);

  if (!open) return null;

  const toggleList = async (list) => {
    if (busyId) return;
    setBusyId(list.id);
    try {
      if (list.containsAlbum) {
        await api.removeFromList(list.id, albumId, userId);
        setLists((prev) =>
          prev.map((l) =>
            l.id === list.id
              ? {
                  ...l,
                  containsAlbum: false,
                  count: Math.max(0, (l.count || 0) - 1),
                }
              : l
          )
        );
        onToast?.({ message: `Removed from ${list.name}`, type: "success" });
      } else {
        await api.addToList(list.id, albumId, userId);
        setLists((prev) =>
          prev.map((l) =>
            l.id === list.id
              ? { ...l, containsAlbum: true, count: (l.count || 0) + 1 }
              : l
          )
        );
        onToast?.({ message: `Saved to ${list.name}`, type: "success" });
      }
    } catch (err) {
      console.error(err);
      onToast?.({ message: "Something went wrong", type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await api.createList(userId, name);
      const list = res.list;
      await api.addToList(list.id, albumId, userId);
      setLists((prev) => [
        ...prev,
        {
          ...list,
          containsAlbum: true,
          count: 1,
          previewCovers: [],
        },
      ]);
      setNewName("");
      setShowCreate(false);
      onToast?.({
        message: `Created "${name}" and saved album`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      onToast?.({
        message: err.message || "Could not create list",
        type: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#131e2c] border border-[#2a3645] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3645]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Save to list
          </h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-white text-lg leading-none"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-2">
          {loading ? (
            <p className="text-stone-500 text-sm text-center py-8">Loading...</p>
          ) : (
            <ul className="space-y-1">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => toggleList(list)}
                    disabled={busyId === list.id}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#1f2b3a] transition-colors text-left disabled:opacity-50"
                  >
                    <span
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 text-xs ${
                        list.containsAlbum
                          ? "bg-[#7cc7e8] border-[#7cc7e8] text-[#0a121c]"
                          : "border-[#3d5068] text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">
                        {list.name}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {list.count} album{list.count !== 1 ? "s" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#2a3645] px-4 py-3">
          {showCreate ? (
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List name"
                className="flex-1 min-w-0 bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8]"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="text-sm font-semibold px-3 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] disabled:opacity-50"
              >
                {creating ? "..." : "Add"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full text-sm text-[#7cc7e8] hover:underline py-1"
            >
              + Create new list
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
