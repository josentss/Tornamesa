"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { Header, Footer } from "@/components/shared";

function AlbumCard({ album }) {
  return (
    <Link href={`/album/${album.id}`} className="group block">
      <div
        className="aspect-square bg-[#131b26] border border-[#1e293b] rounded-lg overflow-hidden mb-2 shadow-sm
          transition-all duration-300 ease-out
          group-hover:border-[#87ceeb]/50 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        {album.coverUrl ? (
          <Image
            src={album.coverUrl}
            alt={album.title || "Album"}
            width={300}
            height={300}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">
            —
          </div>
        )}
      </div>
      <p className="text-xs sm:text-sm font-medium text-[#f0f9ff] line-clamp-2 leading-snug group-hover:text-[#87ceeb] transition-colors">
        {album.title}
      </p>
      <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 line-clamp-1">
        {album.artist}
      </p>
    </Link>
  );
}

const GRID =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4";

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setError("Type at least 2 characters");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const data = await api.searchAlbums(trimmed, "album");
      const list = Array.isArray(data) ? data : [];
      setResults(list);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-lg mx-auto mb-10 sm:mb-12 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#f0f9ff] mb-5">
            Search albums
          </h1>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Album or artist..."
              autoFocus
              autoComplete="off"
              className="w-full bg-[#131b26] border border-[#1e293b] text-[#f0f9ff] placeholder:text-stone-500 rounded-xl px-5 py-3.5 text-sm sm:text-base
                focus:outline-none focus:border-[#87ceeb] focus:shadow-[0_0_0_3px_rgba(135,206,235,0.12)]
                transition-all duration-200"
            />
          </form>

          {error && (
            <p className="mt-3 text-xs text-stone-500">{error}</p>
          )}
        </div>

        {loading && (
          <div className={GRID}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-lg bg-[#131b26] border border-[#1e293b]" />
                <div className="h-3 w-3/4 bg-[#1a2433] rounded mt-2" />
                <div className="h-2.5 w-1/2 bg-[#1a2433] rounded mt-1.5" />
              </div>
            ))}
          </div>
        )}

        {!loading && searched && results.length > 0 && (
          <>
            <p className="text-[11px] text-stone-500 mb-4 text-center sm:text-left">
              {results.length} result{results.length === 1 ? "" : "s"}
              {results.length >= 15 ? " · refine your search for more" : ""}
            </p>
            <div className={GRID}>
              {results.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          </>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <p className="text-center text-stone-500 text-sm py-12">
            No albums found
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
}
