"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import Image from "next/image";

export default function AlbumPage({ params }) {
  const { user } = useAuth();

  // Next.js 15+: params puede ser un Promise
  const rawId = typeof params?.then === "function" ? null : params?.id;
  const [id, setId] = useState(rawId);

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados del formulario de escucha
  const [rating, setRating] = useState("");
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Resolver params si es Promise
  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setId(p.id));
    } else if (params?.id) {
      setId(params.id);
    }
  }, [params]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAlbumDetails(id);
        if (!cancelled) setAlbum(data);
      } catch (err) {
        console.error("Error al cargar el álbum:", err);
        if (!cancelled) setError("No se pudo cargar el álbum.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAlbumData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleRegisterListen = async (e) => {
    e.preventDefault();
    if (!user || !album) return;

    const numericRating = rating ? Number(rating) : null;
    if (numericRating !== null && (numericRating < 1 || numericRating > 5)) {
      setStatusMsg({ type: "error", text: "La calificación debe estar entre 1 y 5." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await api.registerListen(
        album.id,
        user.id,
        numericRating,
        review.trim() || null
      );
      setStatusMsg({ type: "success", text: "¡Disco registrado en tu historial!" });
      setRating("");
      setReview("");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: "error", text: "Error al registrar la escucha." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !id) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Cargando disco..." />
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12">
          <ErrorMessage message={error || "Álbum no encontrado"} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] relative overflow-x-hidden">
      <Header user={user} />

      {/* Banner de fondo */}
      {album.coverUrl && (
        <div className="absolute top-0 left-0 right-0 h-[450px] pointer-events-none overflow-hidden z-0 select-none">
          <div
            className="w-full h-full bg-cover bg-center opacity-25 scale-125 blur-2xl"
            style={{ backgroundImage: `url(${album.coverUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f16]/30 via-[#0a0f16]/70 to-[#0a0f16]" />
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 pt-8 md:pt-16 pb-12 flex flex-col md:flex-row gap-8">
        {/* Columna izquierda */}
        <div className="w-full md:w-1/3 flex flex-col gap-6">
          <div className="aspect-square bg-[#131b26] border border-[#1e293b] rounded-lg overflow-hidden shadow-2xl relative">
            {album.coverUrl ? (
              <Image
                src={album.coverUrl}
                alt={album.title}
                width={500}
                height={500}
                className="w-full h-full object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-600">
                Sin portada
              </div>
            )}
          </div>

          <div className="bg-[#131b26]/90 backdrop-blur-md p-5 rounded-lg border border-[#1e293b]">
            <h3 className="font-bold mb-4 text-[#87ceeb]">Registrar Escucha</h3>

            {user ? (
              <form onSubmit={handleRegisterListen}>
                <div className="mb-4">
                  <label className="text-sm text-stone-400 block mb-2">
                    Calificación (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white focus:outline-none focus:border-[#87ceeb]"
                    placeholder="Ej: 4"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="mb-4">
                  <label className="text-sm text-stone-400 block mb-2">
                    Reseña (opcional)
                  </label>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-2 text-white h-24 resize-none focus:outline-none focus:border-[#87ceeb]"
                    placeholder="¿Qué te pareció el disco?"
                    disabled={isSubmitting}
                  />
                </div>

                {statusMsg && (
                  <div
                    className={`mb-4 text-sm p-2 rounded border ${
                      statusMsg.type === "success"
                        ? "bg-green-900/20 text-green-400 border-green-900/50"
                        : "bg-red-900/20 text-red-400 border-red-900/50"
                    }`}
                  >
                    {statusMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#87ceeb] text-[#0a0f16] py-2 font-bold rounded hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Guardando..." : "Guardar en mi historial"}
                </button>
              </form>
            ) : (
              <div className="text-center text-sm text-stone-400 py-4">
                Inicia sesión para registrar este disco en tu historial.
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="w-full md:w-2/3 flex flex-col pt-2">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 drop-shadow-md">
            {album.title}
          </h1>
          <h2 className="text-xl md:text-2xl text-stone-300 font-medium mb-4">
            {album.artist}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-stone-400 mb-8 border-b border-[#1e293b]/80 pb-6">
            <span>{album.releaseDate}</span>
            <span>•</span>
            <span>{album.totalDuration}</span>

            {album.genres?.length > 0 && (
              <>
                <span>•</span>
                <div className="flex flex-wrap gap-1.5">
                  {album.genres.map((genre, idx) => (
                    <span
                      key={idx}
                      className="bg-[#1e293b]/60 border border-[#1e293b] text-stone-300 px-2 py-0.5 rounded-full text-[11px] capitalize"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <h3 className="text-lg font-bold mb-4 border-l-4 border-[#87ceeb] pl-3">
            Lista de Canciones
          </h3>

          <div className="flex flex-col gap-1">
            {album.tracks?.map((track, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 hover:bg-[#131b26]/70 rounded transition-colors border border-transparent hover:border-[#1e293b]"
              >
                <div className="flex gap-4 items-center">
                  <span className="text-stone-500 text-sm w-4 text-right">
                    {index + 1}
                  </span>
                  <span className="font-medium text-stone-200">{track.name}</span>
                </div>
                <span className="text-stone-400 text-sm">{track.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
