"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import Image from "next/image";

export default function AlbumPage({ params }) {
  const { user } = useAuth();

  const rawId = typeof params?.then === "function" ? null : params?.id;
  const [id, setId] = useState(rawId);

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // reviews
  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null); // review del usuario actual

  // estados del form reseña
  const [rating, setRating] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // solve params (si es promise)
  useEffect(() => {
    if (params && typeof params.then === "function") {
      params.then((p) => setId(p.id));
    } else if (params?.id) {
      setId(params.id);
    }
  }, [params]);

  // load album and reviews (si hay id)
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchData = async () => {
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

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // load album reviews
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchReviews = async () => {
      try {
        const data = await api.getAlbumReviews(id);
        if (!cancelled) {
          setReviews(data.reviews || []);
          // buscando la reseña del usuario con la sesión iniciada
          if (user) {
            const myReview = data.reviews?.find((r) => r.user.id === user.id) || null;
            setUserReview(myReview);
            if (myReview) {
              setRating(myReview.rating.toString());
              setReviewText(myReview.reviewText || "");
            } else {
              setRating("");
              setReviewText("");
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar reseñas:", err);
      }
    };

    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user || !album) return;

    const numericRating = Number(rating);
    if (!rating || numericRating < 1 || numericRating > 5) {
      setStatusMsg({ type: "error", text: "La calificación debe estar entre 1 y 5." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await api.createReview(album.id, numericRating, reviewText.trim() || null);
      setStatusMsg({ type: "success", text: "¡Reseña guardada!" });
      // refresh reseñas
      const updated = await api.getAlbumReviews(album.id);
      setReviews(updated.reviews || []);
      const myNew = updated.reviews?.find((r) => r.user.id === user.id) || null;
      setUserReview(myNew);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: "error", text: "Error al guardar la reseña." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // registrar solo escucha (no reseñar)
  const handleRegisterListen = async () => {
    if (!user || !album) return;
    try {
      await api.registerListen(album.id, user.id, null, null);
      alert("Escucha registrada en tu historial");
    } catch (err) {
      console.error(err);
      alert("Error al registrar escucha");
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
        {/* columna izquierda */}
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

          {/* reseña personal */}
          <div className="bg-[#131b26]/90 backdrop-blur-md p-5 rounded-lg border border-[#1e293b]">
            <h3 className="font-bold mb-4 text-[#87ceeb]">
              {userReview ? "Editar tu reseña" : "Escribe una reseña"}
            </h3>

            {user ? (
              <form onSubmit={handleSubmitReview}>
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
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="text-sm text-stone-400 block mb-2">
                    Comentario (opcional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
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
                  {isSubmitting ? "Guardando..." : userReview ? "Actualizar reseña" : "Publicar reseña"}
                </button>

                {/* btn de registro escucha*/}
                <button
                  type="button"
                  onClick={handleRegisterListen}
                  className="w-full mt-3 text-sm text-stone-400 hover:text-white transition-colors"
                >
                  Solo marcar como escuchado
                </button>
              </form>
            ) : (
              <div className="text-center text-sm text-stone-400 py-4">
                Inicia sesión para dejar tu reseña.
              </div>
            )}
          </div>
        </div>

        {/* columna derecha */}
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

          <div className="flex flex-col gap-1 mb-10">
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

          {/* reviews section */}
          <section>
            <h3 className="text-lg font-bold mb-6 border-l-4 border-[#87ceeb] pl-3">
              Reseñas ({reviews.length})
            </h3>

            {reviews.length === 0 ? (
              <p className="text-stone-500 text-sm italic">Nadie ha reseñado este álbum aún.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-[#131b26]/60 border border-[#1e293b] rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-stone-700 overflow-hidden relative">
                        {review.user.avatarUrl ? (
                          <Image
                            src={review.user.avatarUrl}
                            alt={review.user.username}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">
                            {review.user.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-white">
                          {review.user.username}
                        </span>
                        <div className="flex text-yellow-400 text-sm">
                          {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                        </div>
                      </div>
                    </div>
                    {review.reviewText && (
                      <p className="text-stone-300 text-sm whitespace-pre-line">
                        {review.reviewText}
                      </p>
                    )}
                    <p className="text-stone-500 text-xs mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                      {review.updatedAt !== review.createdAt && " (editado)"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
