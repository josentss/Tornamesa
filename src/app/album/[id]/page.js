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

  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);

  const [rating, setRating] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

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
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchReviews = async () => {
      try {
        const data = await api.getAlbumReviews(id);
        if (!cancelled) {
          setReviews(data.reviews || []);
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
    return () => { cancelled = true; };
  }, [id, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user || !album) return;

    const numericRating = Number(rating);
    if (!rating || numericRating < 1 || numericRating > 10) {
      setStatusMsg({ type: "error", text: "La calificación debe estar entre 1 y 10." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await api.createReview(album.id, numericRating, reviewText.trim() || null);
      setStatusMsg({ type: "success", text: "¡Reseña guardada!" });
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

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] relative overflow-x-hidden">
      <Header user={user} />

      {album.coverUrl && (
        <div className="absolute top-0 left-0 right-0 h-[450px] pointer-events-none overflow-hidden z-0 select-none">
          <div
            className="w-full h-full bg-cover bg-center opacity-20 scale-125 blur-3xl"
            style={{ backgroundImage: `url(${album.coverUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f16]/20 via-[#0a0f16]/80 to-[#0a0f16]" />
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 pt-12 md:pt-24 pb-16 flex flex-col md:flex-row gap-10">
        {/* Columna izquierda – portada y acciones */}
        <div className="w-full md:w-[300px] flex flex-col gap-6 md:sticky md:top-24 self-start">
          <div className="aspect-square bg-gradient-to-br from-[#1a2332] to-[#0f1721] border border-[#2a3645] rounded-xl overflow-hidden shadow-2xl shadow-black/40 group">
            {album.coverUrl ? (
              <Image
                src={album.coverUrl}
                alt={album.title}
                width={600}
                height={600}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-600">
                Sin portada
              </div>
            )}
          </div>

          <div className="bg-[#131e2c]/80 backdrop-blur-xl p-5 rounded-xl border border-[#2a3645] shadow-lg">
            <h3 className="font-semibold text-[#7cc7e8] mb-4 text-base tracking-wide uppercase">
              {userReview ? "Tu reseña" : "Escribí una reseña"}
            </h3>

            {user ? (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="text-xs text-stone-400 block mb-1.5 uppercase tracking-wider">
                    Puntuación (1‑10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#7cc7e8] focus:ring-1 focus:ring-[#7cc7e8] transition-all"
                    placeholder="Ej: 8"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1.5 uppercase tracking-wider">
                    Comentario
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                    className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-white resize-none focus:outline-none focus:border-[#7cc7e8] focus:ring-1 focus:ring-[#7cc7e8] transition-all"
                    placeholder="¿Qué te pareció este disco?"
                    disabled={isSubmitting}
                  />
                </div>

                {statusMsg && (
                  <div
                    className={`text-sm px-3 py-2 rounded-lg border ${
                      statusMsg.type === "success"
                        ? "bg-green-900/30 text-green-300 border-green-800"
                        : "bg-red-900/30 text-red-300 border-red-800"
                    }`}
                  >
                    {statusMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#7cc7e8] text-[#0a121c] py-2.5 font-bold rounded-lg hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-xl"
                >
                  {isSubmitting ? "Guardando..." : userReview ? "Actualizar" : "Publicar reseña"}
                </button>

                <button
                  type="button"
                  onClick={handleRegisterListen}
                  className="w-full text-sm text-stone-400 hover:text-stone-200 transition-colors py-1"
                >
                  Solo marcar como escuchado
                </button>
              </form>
            ) : (
              <div className="text-center text-sm text-stone-400 py-6">
                Iniciá sesión para dejar tu reseña.
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha – info + canciones + reseñas */}
        <div className="flex-1 min-w-0">
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              {album.title}
            </h1>
            <h2 className="text-xl md:text-2xl text-stone-300 font-light mt-2">
              {album.artist}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm text-stone-400">
              <span>{album.releaseDate}</span>
              <span className="text-stone-600">•</span>
              <span>{album.totalDuration}</span>
              {album.genres?.length > 0 && (
                <>
                  <span className="text-stone-600">•</span>
                  <div className="flex flex-wrap gap-1.5">
                    {album.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className="bg-[#1f2b3a]/70 border border-[#2a3645] text-stone-200 px-2.5 py-0.5 rounded-full text-xs capitalize"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {averageRating && (
                <>
                  <span className="text-stone-600">•</span>
                  <span className="text-yellow-300 font-medium">
                    {averageRating} / 10
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Lista de canciones */}
          <div className="mb-12">
            <h3 className="text-base font-semibold uppercase tracking-widest text-stone-400 mb-4 border-b border-[#2a3645] pb-2">
              Canciones
            </h3>
            <div className="flex flex-col gap-0.5">
              {album.tracks?.map((track, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-3 px-3 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-stone-500 text-sm w-5 text-right font-mono">
                      {index + 1}
                    </span>
                    <span className="font-medium text-stone-200 group-hover:text-white transition-colors">
                      {track.name}
                    </span>
                  </div>
                  <span className="text-stone-500 text-sm">{track.duration}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reseñas */}
          <section>
            <h3 className="text-base font-semibold uppercase tracking-widest text-stone-400 mb-6 border-b border-[#2a3645] pb-2">
              Reseñas ({reviews.length})
            </h3>

            {reviews.length === 0 ? (
              <div className="bg-[#131e2c]/40 border border-[#2a3645] rounded-xl p-6 text-center text-stone-500">
                Sé el primero en reseñar este álbum.
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-[#131e2c]/50 backdrop-blur-sm border border-[#2a3645] rounded-xl p-5 hover:border-[#3d5068] transition-all shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-full bg-[#1f2b3a] border border-[#2a3645] overflow-hidden flex-shrink-0 relative">
                        {review.user.avatarUrl ? (
                          <Image
                            src={review.user.avatarUrl}
                            alt={review.user.username}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm font-bold">
                            {review.user.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-white">
                            {review.user.username}
                          </span>
                          <span className="text-yellow-300 font-bold text-lg">
                            {review.rating}/10
                          </span>
                        </div>
                        {review.reviewText && (
                          <p className="text-stone-300 text-sm mt-2 leading-relaxed whitespace-pre-line">
                            {review.reviewText}
                          </p>
                        )}
                        <p className="text-stone-500 text-xs mt-3">
                          {new Date(review.createdAt).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {review.updatedAt !== review.createdAt && (
                            <span className="italic ml-2">(editado)</span>
                          )}
                        </p>
                      </div>
                    </div>
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
