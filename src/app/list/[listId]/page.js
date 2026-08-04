"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";

export default function ListDetailPage({ params }) {
  const rawId = typeof params?.then === "function" ? null : params?.listId;
  const [listId, setListId] = useState(rawId);
  const { user } = useAuth();

  const [list, setList] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {list.username && (
          <Link
            href={`/${list.username}`}
            className="text-xs text-stone-500 hover:text-[#7cc7e8] transition-colors"
          >
            ← @{list.username}
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">{list.name}</h1>
        {list.description && (
          <p className="text-stone-400 text-sm mt-1">{list.description}</p>
        )}
        <p className="text-xs text-stone-500 mt-2">
          {list.count} album{list.count !== 1 ? "s" : ""}
        </p>

        {albums.length === 0 ? (
          <div className="mt-10 py-12 text-center bg-[#131e2c]/50 border border-[#2a3645] rounded-xl">
            <p className="text-stone-400 text-sm">This list is empty</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
            {albums.map((item) => (
              <Link
                key={item.itemId || item.album.id}
                href={`/album/${item.album.id}`}
                className="group min-w-0"
              >
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
                <p className="text-[10px] text-stone-500 truncate">{item.album.artist}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
