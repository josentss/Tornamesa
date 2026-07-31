"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { Header, Footer, ErrorMessage, LoadingSpinner } from "@/components/shared";

const AlbumCard = ({ album }) => (
  <Link href={`/album/${album.id}`} className="group block cursor-pointer">
    <div className="aspect-square bg-[#131b26] border border-[#1e293b] rounded overflow-hidden mb-2 group-hover:border-[#87ceeb] transition-all">
      {album.coverUrl ? (
        <Image
          src={album.coverUrl}
          alt={album.title}
          width={300}
          height={300}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-600 text-xs">
          No cover
        </div>
      )}
    </div>
    <h3 className="text-xs md:text-sm font-medium text-[#f0f9ff] truncate group-hover:text-[#87ceeb] transition-colors">
      {album.title}
    </h3>
    <p className="text-[10px] md:text-xs text-stone-400 truncate">{album.artist}</p>
  </Link>
);

const UserCard = ({ user }) => {
  const safeUsername = user?.username || "usuario";
  const initial = safeUsername.charAt(0).toUpperCase();

  return (
    <Link
      href={`/${safeUsername}`}
      className="group flex items-center gap-4 bg-[#131b26] border border-[#1e293b] p-4 rounded-lg hover:border-[#87ceeb] transition-all"
    >
      <div className="w-12 h-12 bg-[#0a0f16] rounded-full overflow-hidden flex items-center justify-center text-[#87ceeb] font-bold text-lg shrink-0">
        {user?.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={safeUsername}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <h3 className="text-sm font-bold text-[#f0f9ff] truncate group-hover:text-[#87ceeb] transition-colors">
          {user?.full_name || safeUsername}
        </h3>
        <p className="text-xs text-stone-400 truncate">@{safeUsername}</p>
      </div>
    </Link>
  );
};

export default function BuscarPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("album");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(
    async (q, type) => {
      if (!q.trim() || q.trim().length < 2) {
        setError("Minimum 2 characters required");
        return;
      }

      setLoading(true);
      setError(null);
      setSearched(true);

      try {
        const data = await api.searchAlbums(q, type);
        setResultados(Array.isArray(data) ? data : []);
        if (!Array.isArray(data) || data.length === 0) {
          setError("No results found");
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Connection error");
        setResultados([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(query, searchType);
  };

  const changeType = (type) => {
    setSearchType(type);
    setResultados([]);
    setSearched(false);
    setError(null);

    if (query.trim().length >= 2) {
      performSearch(query, type);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16]">
      <Header user={user} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-6 md:py-12">
        <form onSubmit={handleSearch} className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchType === "album" ? "Search albums..." : "Search users..."
            }
            className="w-full max-w-md bg-[#131b26] border border-[#1e293b] text-[#f0f9ff] placeholder:text-stone-500 p-3 rounded focus:outline-none focus:border-[#87ceeb] transition-colors"
            autoFocus
          />
        </form>

        <div className="flex gap-4 mb-8 border-b border-[#1e293b] pb-4">
          <button
            type="button"
            onClick={() => changeType("album")}
            className={`text-sm font-bold tracking-wider uppercase transition-colors ${
              searchType === "album"
                ? "text-[#87ceeb]"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Albums
          </button>
          <button
            type="button"
            onClick={() => changeType("user")}
            className={`text-sm font-bold tracking-wider uppercase transition-colors ${
              searchType === "user"
                ? "text-[#87ceeb]"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Users
          </button>
        </div>

        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {loading && <LoadingSpinner message="Searching..." />}

        {!loading && searched && resultados.length > 0 && (
          <div
            className={
              searchType === "album"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6"
                : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            }
          >
            {resultados.map((item) =>
              searchType === "album" ? (
                <AlbumCard key={item.id} album={item} />
              ) : (
                <UserCard key={item.id} user={item} />
              )
            )}
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-20 text-stone-400">
            Type to start searching
          </div>
        )}

        {!loading && searched && resultados.length === 0 && !error && (
          <div className="text-center py-20 text-stone-400">
            No results for &quot;{query}&quot;
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
