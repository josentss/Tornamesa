"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner, ErrorMessage } from "@/components/shared";
import { api } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import Toast from "@/components/Toast";

function StarRating({ value, onChange, size = "md" }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value || 0;
  const starSize = size === "lg" ? "w-7 h-7" : "w-6 h-6";

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const active = n <= display;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            className={`${starSize} flex items-center justify-center transition-transform hover:scale-110 focus:outline-none`}
            aria-label={`Rate ${n} out of 10`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-full h-full transition-colors duration-100 ${
                active
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-stone-600"
              }`}
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-semibold text-yellow-400 tabular-nums">
          {value}/10
        </span>
      )}
    </div>
  );
}

export default function AlbumPage({ params }) {
  const { user } = useAuth();

  const rawId = typeof params?.then === "function" ? null : params?.id;
  const [id, setId] = useState(rawId);

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);

  const [showRatePanel, setShowRatePanel] = useState(false);
  const [rating, setRating] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [toast, setToast] = useState(null);

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
        console.error("Error loading album:", err);
        if (!cancelled) setError("Could not load album.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchReviews = async () => {
      try {
        const data = await api.getAlbumReviews(id);
        if (cancelled) return;

        setReviews(data.reviews || []);
        if (user) {
          const myReview =
            data.reviews?.find((r) => r.user.id === user.id) || null;
          setUserReview(myReview);
          if (myReview) {
            setRating(myReview.rating);
            setReviewText(myReview.reviewText || "");
          }
        }
      } catch (err) {
        console.error("Error loading reviews:", err);
      }
    };

    fetchReviews();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const handleQuickLog = async () => {
    if (!user || !album) return;
    setIsLogging(true);
    try {
      await api.registerListen(album.id, user.id, null, null);
      setToast({ message: "Listen logged!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({
        message: err.message || "Could not log listen",
        type: "error",
      });
    } finally {
      setIsLogging(false);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!user || !album) return;

    if (!rating || rating < 1 || rating > 10) {
      setToast({ message: "Please choose a rating from 1 to 10", type: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.registerListen(
        album.id,
        user.id,
        rating,
        reviewText.trim() || null
      );

      try {
        const result = await api.createReview(
          album.id,
          rating,
          reviewText.trim() || null
        );
        const newReview = result.review;

        setReviews((prev) => {
          const filtered = prev.filter((r) => r.user.id !== user.id);
          return [newReview, ...filtered];
        });
        setUserReview(newReview);
      } catch (reviewErr) {
        console.warn("Review save failed:", reviewErr);
      }

      setToast({
        message: userReview ? "Rating updated!" : "Album logged with rating!",
        type: "success",
      });
      setShowRatePanel(false);
    } catch (err) {
      console.error(err);
      setToast({
        message: err.message || "Could not save rating",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !id) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading album..." />
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <Header user={user} />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12">
          <ErrorMessage message={error || "Album not found"} />
        </main>
        <Footer />
      </div>
    );
  }

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff] relative overflow-x-hidden">
      <Header user={user} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Atmospheric cover background */}
      {album.coverUrl && (
        <div className="absolute top-0 left-0 right-0 h-[55vh] sm:h-[50vh] md:h-[480px] pointer-events-none overflow-hidden z-0 select-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40 sm:opacity-45"
            style={{ backgroundImage: `url(${album.coverUrl})` }}
          />
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 blur-md opacity-25"
            style={{ backgroundImage: `url(${album.coverUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f16]/20 via-[#0a0f16]/70 to-[#0a0f16]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16]/40 via-transparent to-[#0a0f16]/40" />
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 pt-8 sm:pt-10 md:pt-14 pb-14 sm:pb-16">
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 md:gap-10">
          {/* LEFT: Cover + actions */}
          <div className="w-full md:w-72 flex-shrink-0 flex flex-col gap-4 sm:gap-5 md:sticky md:top-24 self-start">
            {/* Cover – centered on mobile */}
            <div className="w-full max-w-[280px] sm:max-w-none mx-auto md:mx-0 aspect-square rounded-xl overflow-hidden border border-[#2a3645] bg-[#1f2b3a] shadow-2xl shadow-black/50">
              {album.coverUrl ? (
                <Image
                  src={album.coverUrl}
                  alt={album.title}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-600 text-sm">
                  No cover
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-[#131e2c]/90 backdrop-blur-sm border border-[#2a3645] rounded-xl p-4 sm:p-5 space-y-3">
              {user ? (
                <>
                  {!showRatePanel ? (
                    <>
                      <button
                        onClick={handleQuickLog}
                        disabled={isLogging}
                        className="w-full bg-[#7cc7e8] text-[#0a121c] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#a5d8f0] transition-all disabled:opacity-50 shadow-lg shadow-[#7cc7e8]/15"
                      >
                        {isLogging ? "Logging..." : "Log listen"}
                      </button>

                      <button
                        onClick={() => setShowRatePanel(true)}
                        className="w-full bg-[#1f2b3a] hover:bg-[#2a3645] text-sm font-semibold py-2.5 rounded-lg border border-[#2a3645] hover:border-[#3d5068] transition-all"
                      >
                        {userReview ? "Update rating" : "Rate & review"}
                      </button>

                      {userReview && (
                        <p className="text-[11px] text-stone-500 text-center pt-1">
                          Your rating:{" "}
                          <span className="text-yellow-400 font-medium">
                            ★ {userReview.rating}/10
                          </span>
                        </p>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleSubmitRating} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                          {userReview ? "Update rating" : "Rate album"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowRatePanel(false)}
                          className="text-stone-500 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Star rating */}
                      <div>
                        <p className="text-[11px] text-stone-500 mb-2.5">
                          Tap a star to rate
                        </p>
                        <StarRating value={rating} onChange={setRating} />
                      </div>

                      <div>
                        <label className="text-[11px] text-stone-500 block mb-1.5">
                          Review (optional)
                        </label>
                        <textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          rows={4}
                          placeholder="What did you think?"
                          disabled={isSubmitting}
                          className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-2.5 text-sm text-white resize-none focus:outline-none focus:border-[#7cc7e8] transition-colors leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !rating}
                        className="w-full bg-[#7cc7e8] text-[#0a121c] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#a5d8f0] transition-all disabled:opacity-50"
                      >
                        {isSubmitting
                          ? "Saving..."
                          : userReview
                          ? "Update"
                          : "Save rating"}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-stone-400 py-4">
                  <Link href="/" className="text-[#7cc7e8] hover:underline">
                    Log in
                  </Link>{" "}
                  to log this album.
                </p>
              )}
            </div>

            {album.spotifyUrl && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs text-stone-500 hover:text-[#1db954] transition-colors"
              >
                Open in Spotify ↗
              </a>
            )}
          </div>

          {/* RIGHT: Info + tracks + reviews */}
          <div className="flex-1 min-w-0">
            <div className="mb-6 sm:mb-8 text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                {album.title}
              </h1>
              <h2 className="text-base sm:text-lg md:text-xl text-stone-300 mt-1.5 sm:mt-2 font-light">
                {album.artist}
              </h2>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 mt-3 sm:mt-4 text-sm text-stone-400">
                <span>{album.releaseDate}</span>
                {album.totalDuration && (
                  <>
                    <span className="text-stone-600">·</span>
                    <span>{album.totalDuration}</span>
                  </>
                )}
                {averageRating && (
                  <>
                    <span className="text-stone-600">·</span>
                    <span className="text-yellow-400 font-medium">
                      ★ {averageRating}/10
                    </span>
                    <span className="text-stone-500 text-xs">
                      ({reviews.length})
                    </span>
                  </>
                )}
              </div>

              {album.genres?.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mt-3 sm:mt-4">
                  {album.genres.map((genre, idx) => (
                    <span
                      key={idx}
                      className="bg-[#1f2b3a]/80 border border-[#2a3645] text-stone-300 px-2.5 py-0.5 rounded-full text-[11px] capitalize"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tracklist */}
            <div className="mb-10 sm:mb-12">
              <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                Tracklist
              </h3>
              <div className="space-y-0.5">
                {album.tracks?.map((track, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span className="text-stone-600 text-xs w-5 text-right font-mono flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm text-stone-200 truncate">
                        {track.name}
                      </span>
                    </div>
                    <span className="text-stone-500 text-xs flex-shrink-0 ml-2 sm:ml-3">
                      {track.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <section>
              <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mb-4 sm:mb-5 pb-2 border-b border-[#2a3645]">
                Reviews ({reviews.length})
              </h3>

              {reviews.length === 0 ? (
                <div className="bg-[#131e2c]/50 border border-[#2a3645] rounded-xl p-6 sm:p-8 text-center">
                  <p className="text-stone-400 text-sm">No reviews yet</p>
                  <p className="text-stone-500 text-xs mt-1">
                    Be the first to rate this album.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-[#131e2c]/60 border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Link
                          href={`/${review.user?.username || ""}`}
                          className="flex items-center gap-2.5 min-w-0 group"
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1f2b3a] border border-[#2a3645] flex-shrink-0">
                            {review.user?.avatar_url ? (
                              <Image
                                src={review.user.avatar_url}
                                alt={review.user.username || "User"}
                                width={32}
                                height={32}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-stone-400">
                                {(review.user?.username || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-white group-hover:text-[#7cc7e8] transition-colors truncate">
                            {review.user?.username || "User"}
                          </span>
                        </Link>
                        <span className="text-yellow-400 text-sm font-semibold flex-shrink-0">
                          ★ {review.rating}/10
                        </span>
                      </div>
                      {review.reviewText && (
                        <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap break-words mt-1">
                          {review.reviewText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
