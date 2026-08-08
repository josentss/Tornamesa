"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { Header, Footer, ErrorMessage } from "@/components/shared";

function AlbumCard({ album }) {
  return (
    <Link href={`/album/${album.id}`} className="group block">
      <div className="aspect-square bg-[#131e2c] border border-[#2a3645] rounded-xl overflow-hidden mb-2.5 group-hover:border-[#7cc7e8]/60 transition-all shadow-sm group-hover:shadow-[0_8px_24px_-8px_rgba(124,199,232,0.25)]">
        {album.coverUrl ? (
          <Image
            src={album.coverUrl}
            alt={album.title}
            width={300}
            height={300}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">
            No cover
          </div>
        )}
      </div>
      <h3 className="text-sm font-semibold text-[#f0f9ff] truncate group-hover:text-[#7cc7e8] transition-colors">
        {album.title}
      </h3>
      <p className="text-xs text-stone-400 truncate mt-0.5">{album.artist}</p>
      {album.releaseDate && album.releaseDate !== "N/A" && (
        <p className="text-[10px] text-stone-600 mt-0.5">
          {String(album.releaseDate).slice(0, 4)}
        </p>
      )}
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
      const data = await api.searchAlbums(trimmed);
      setResults(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        setError(null);
      }
    } catch (err) {
      console.error(err);
      setError("Search temporarily unavailable");
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
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Centered search */}
        <div className="max-w-xl mx-auto text-center mb-10 sm:mb-14">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Search albums
          </h1>
          <p className="text-stone-400 text-sm mb-6">
            Find a record to log, rate, or add to a list
          </p>

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Album or artist..."
              className="w-full bg-[#131e2c] border border-[#2a3645] rounded-2xl pl-5 pr-14 py-4 text-base text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] focus:ring-1 focus:ring-[#7cc7e8]/30 transition-all shadow-lg"
              autoFocus
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#7cc7e8] text-[#0a121c] flex items-center justify-center hover:bg-[#a5d8f0] disabled:opacity-50 transition-colors"
              aria-label="Search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14" />
              </svg>
            </button>
          </form>

          <p className="text-xs text-stone-600 mt-4">
            Looking for people?{" "}
            <Link
              href="/discover"
              className="text-[#7cc7e8] hover:underline"
            >
              Discover listeners
            </Link>
          </p>
        </div>

        {error && (
          <div className="max-w-xl mx-auto mb-6">
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl bg-[#131e2c] border border-[#2a3645]" />
                <div className="h-3 w-3/4 bg-[#1f2b3a] rounded mt-2.5" />
                <div className="h-2.5 w-1/2 bg-[#1f2b3a] rounded mt-1.5" />
              </div>
            ))}
          </div>
        )}

        {!loading && searched && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {results.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">
              No albums found for &quot;{query.trim()}&quot;
            </p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-8 text-stone-600 text-sm">
            Start typing to search Spotify
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
