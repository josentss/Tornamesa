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
      <div className="aspect-square bg-[#131b26] border border-[#1e293b] rounded-lg overflow-hidden mb-2 group-hover:border-[#87ceeb]/70 transition-colors duration-200">
        {album.coverUrl ? (
          <Image
            src={album.coverUrl}
            alt={album.title}
            width={300}
            height={300}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">
            —
          </div>
        )}
      </div>
      <h3 className="text-xs sm:text-sm font-medium text-[#f0f9ff] truncate group-hover:text-[#87ceeb] transition-colors">
        {album.title}
      </h3>
      <p className="text-[10px] sm:text-xs text-stone-400 truncate">
        {album.artist}
      </p>
    </Link>
  );
}

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
      // Always albums only
      const data = await api.searchAlbums(trimmed, "album");
      const list = Array.isArray(data) ? data : [];
      setResults(list);
      if (list.length === 0) setError(null);
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
        {/* Title + input */}
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

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-lg bg-[#131b26] border border-[#1e293b]" />
                <div className="h-3 w-3/4 bg-[#1a2433] rounded mt-2" />
                <div className="h-2.5 w-1/2 bg-[#1a2433] rounded mt-1.5" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && searched && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 animate-in fade-in duration-300">
            {results.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
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
