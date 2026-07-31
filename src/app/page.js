"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer, ErrorMessage, LoadingSpinner } from "@/components/shared";
import Image from "next/image";
import Link from "next/link";

// ======================= MODALES DE AUTENTICACIÓN =======================
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-[fade-in_0.2s_ease-out]">
      <div className="bg-[#131b26] border border-[#1e293b] rounded-lg p-6 w-full max-w-md relative shadow-2xl animate-[slide-up_0.2s_ease-out]">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-500 hover:text-white font-bold transition-colors">✕</button>
        {children}
      </div>
    </div>
  );
};

const AuthModals = ({ showLogin, setShowLogin, showRegister, setShowRegister }) => {
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captchaOk, setCaptchaOk] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const resetStates = () => {
    setError("");
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setAcceptTerms(false);
    setCaptchaOk(false);
    setRememberMe(false);
  };

  const closeAll = () => {
    setShowLogin(false);
    setShowRegister(false);
    resetStates();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Email and password required");
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
      closeAll();
    } catch (err) {
      setError(err.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !username || !password || !confirmPassword) return setError("All fields are required");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must have at least 6 characters");
    if (!acceptTerms) return setError("You must accept the terms and conditions");
    if (!captchaOk) return setError("Please complete the security captcha");

    setLoading(true);
    try {
      await signUp(email, password, username);
      alert("Registered successfully. Please log in.");
      setShowRegister(false);
      setShowLogin(true);
      resetStates();
    } catch (err) {
      setError(err.message || "Error registering");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={showLogin} onClose={closeAll}>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">Log in</h2>
            <p className="text-stone-400 text-sm">Welcome back to Tornamesa</p>
          </div>
          {error && <ErrorMessage message={error} onDismiss={() => setError("")} />}
          <form onSubmit={handleLogin} className="space-y-4 flex flex-col">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />

            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-400">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-3 h-3 rounded bg-[#0a0f16] border-[#1e293b]" />
              Remember me on this device
            </label>

            <button type="submit" disabled={loading} className="w-full bg-[#87ceeb] text-[#0a0f16] py-2 rounded font-bold hover:bg-white transition-all disabled:opacity-50 mt-2">
              {loading ? "Entering..." : "Log In"}
            </button>
          </form>
          <div className="text-center text-sm text-stone-400">
            Don&apos;t have an account? <button onClick={() => { setShowLogin(false); setShowRegister(true); resetStates(); }} className="text-[#87ceeb] hover:text-white transition-colors">Sign up</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRegister} onClose={closeAll}>
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-1">Create account</h2>
            <p className="text-stone-400 text-sm">Join Tornamesa</p>
          </div>
          {error && <ErrorMessage message={error} onDismiss={() => setError("")} />}
          <form onSubmit={handleRegister} className="space-y-3 flex flex-col">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              disabled={loading}
              className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={loading}
                className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm"
                disabled={loading}
                className="w-full bg-[#0a0f16] border border-[#1e293b] rounded p-3 text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
              />
            </div>

            <div className="bg-[#0a0f16] border border-[#1e293b] p-3 rounded flex items-center justify-between hover:border-[#87ceeb] transition-colors">
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={captchaOk} onChange={(e) => setCaptchaOk(e.target.checked)} className="w-5 h-5 rounded border-gray-600 appearance-none bg-[#131b26] checked:bg-[#87ceeb] transition-colors" />
                  {captchaOk && <span className="absolute text-[#0a0f16] text-xs font-bold pointer-events-none">✓</span>}
                </div>
                I am not a robot
              </label>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-stone-500 font-semibold tracking-wider">reCAPTCHA</span>
                <span className="text-[8px] text-stone-600">Privacy - Terms</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-400 mt-2">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="w-3 h-3 rounded" />
              I accept the terms of service and privacy policy.
            </label>

            <button type="submit" disabled={loading} className="w-full bg-[#00e054] text-[#0a0f16] py-2 mt-2 rounded font-bold hover:bg-[#00c045] transition-all disabled:opacity-50">
              {loading ? "Registering..." : "Sign Up"}
            </button>
          </form>
          <div className="text-center text-sm text-stone-400">
            Already have an account? <button onClick={() => { setShowRegister(false); setShowLogin(true); resetStates(); }} className="text-[#87ceeb] hover:text-white transition-colors">Log in</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// ======================= VISTAS PRINCIPALES =======================

const PublicHeader = ({ onLogin, onRegister }) => (
  <header className="absolute top-0 w-full z-20 flex justify-between items-center px-6 py-4">
    <div className="text-xl font-bold tracking-tighter text-[#f0f9ff]">Tornamesa</div>
    <nav className="flex items-center gap-4 text-xs md:text-sm font-semibold tracking-wider">
      <button onClick={onLogin} className="text-stone-300 hover:text-white transition-colors">Log in</button>
      <button onClick={onRegister} className="text-stone-300 hover:text-white transition-colors">Create account</button>
    </nav>
  </header>
);

const LandingView = ({ onRegister }) => (
  <div className="flex-1 flex flex-col w-full bg-[#0a0f16]">
    <div className="relative w-full min-h-[75vh] flex flex-col justify-center px-6 md:px-12 lg:px-24 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/hero-bg.jpg"
          alt="Musical background"
          fill
          priority
          className="object-cover opacity-30 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-[#0a0f16]/90 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-transparent to-transparent z-10" />
      </div>

      <div className="relative z-20 max-w-3xl space-y-8 mt-16">
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.1]">
          <span className="text-[#f0f9ff]">Track the albums you listen to.</span>
          <br />
          <span className="text-stone-400">Save the ones you want to hear.</span>
          <br />
          <span className="text-[#87ceeb]">Share with friends what they play.</span>
        </h1>

        <p className="text-stone-400 max-w-xl text-lg font-light">
          Discover, rate, and share your love for music in this place.
        </p>

        <button
          onClick={onRegister}
          className="inline-block bg-[#87ceeb] text-[#0a0f16] px-8 py-3.5 rounded-md font-semibold hover:bg-white transition-all text-sm shadow-[0_0_15px_rgba(135,206,235,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        >
          Create free account
        </button>
      </div>
    </div>

    <div className="w-full max-w-6xl mx-auto px-6 py-16 relative z-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">🎧</div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Track your music</h3>
          <p className="text-stone-400 text-sm leading-relaxed">Keep an exact diary of every album you play and rate them.</p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">📌</div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Review records</h3>
          <p className="text-stone-400 text-sm leading-relaxed">Write an article about an album you have listened to.</p>
        </div>
        <div className="bg-[#131b26]/80 backdrop-blur-sm border border-[#1e293b] p-8 rounded-xl space-y-4 hover:border-[#87ceeb]/50 transition-colors">
          <div className="w-10 h-10 bg-[#1e293b] rounded-lg flex items-center justify-center text-xl text-[#87ceeb]">👥</div>
          <h3 className="font-semibold text-lg text-[#f0f9ff]">Interact with users</h3>
          <p className="text-stone-400 text-sm leading-relaxed">Discover new music by exploring the recent activity of people you follow.</p>
        </div>
      </div>
    </div>
  </div>
);

// Componentes de Tarjetas Reutilizables para el Dashboard
const AmigoCard = ({ album, usuario }) => (
  <div className="group flex flex-col w-full">
    <div className="relative aspect-square w-full bg-[#131b26] rounded-lg border border-[#1e293b] overflow-hidden transition-all duration-300 shadow-sm group-hover:border-[#87ceeb]/50 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
      <Image
        src={album.coverUrl}
        alt={album.title}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16]/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end">
        <h3 className="text-xs sm:text-sm font-bold text-[#f0f9ff] leading-tight truncate">{album.title}</h3>
        <p className="text-[9px] sm:text-[10px] text-stone-300 truncate">{album.artist}</p>
      </div>
    </div>
    {usuario && (
      <div className="mt-2.5 flex items-center gap-2 px-1">
        <div className="w-5 h-5 rounded-full bg-[#1e293b] flex shrink-0 items-center justify-center text-[10px] font-bold text-[#87ceeb]">
          {usuario.charAt(0).toUpperCase()}
        </div>
        <Link href={`/${usuario}`} className="text-[11px] sm:text-xs text-stone-400 hover:text-[#f0f9ff] cursor-pointer transition-colors truncate">
          {usuario}
        </Link>
      </div>
    )}
  </div>
);

const ArtistCard = ({ artist }) => (
  <div className="group flex flex-col w-full items-center text-center cursor-pointer">
    <div className="relative w-full aspect-square rounded-full bg-[#131b26] border border-[#1e293b] overflow-hidden mb-3 transition-all duration-300 group-hover:border-[#87ceeb] group-hover:shadow-[0_0_15px_rgba(135,206,235,0.2)]">
       <Image
         src={artist.imageUrl}
         alt={artist.name}
         fill
         sizes="(max-width: 768px) 33vw, 16vw"
         className="object-cover"
       />
    </div>
    <h3 className="text-xs sm:text-sm font-bold text-[#f0f9ff] truncate w-full group-hover:text-[#87ceeb] transition-colors">{artist.name}</h3>
  </div>
);

// NUEVO: Dashboard estructurado según requerimientos exactos
const DashboardView = ({ feed }) => (
  <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-14 space-y-14 w-full mt-16 text-[#f0f9ff]">

    <section>
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-6">
        <h2 className="text-xs md:text-sm text-stone-400 font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">
          What your friends are listening to
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
        {feed && feed.length > 0 ? (
          feed.map((item, index) => (
            <AmigoCard
              key={item.id || index}
              album={{
                title: item.album_title,
                artist: item.artist_name,
                coverUrl: item.album_cover
              }}
              usuario={item.username || "Usuario"}
            />
          ))
        ) : (
          <div className="col-span-full py-8 text-center bg-[#131b26]/40 rounded-xl border border-[#1e293b]/50">
             <p className="text-stone-400 text-sm">No recent activity from people you follow.</p>
             <Link href="/search" className="text-[#87ceeb] text-xs font-bold hover:underline mt-2 inline-block">Find people to follow</Link>
          </div>
        )}
      </div>
    </section>

    <section>
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-6">
        <h2 className="text-xs md:text-sm text-stone-400 font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">
          Recent artists among friends
        </h2>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 md:gap-6">
        {/* Espacio para el endpoint */}
      </div>
    </section>

    <section>
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-6">
        <h2 className="text-xs md:text-sm text-stone-400 font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">
          Popular in the community
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
         {/* Espacio para mapear datos */}
      </div>
    </section>

    <section>
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-6">
        <h2 className="text-xs md:text-sm text-stone-400 font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer">
          Community Articles
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
         {/* Espacio para mapear artículos reales */}
      </div>
    </section>

  </main>
);

export default function Page() {
  const { user, loading } = useAuth();
  const [feed, setFeed] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (user) {
        try {
          const data = await api.getFriendsFeed(user.id);
          setFeed(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error('Error fetching feed:', error);
          setFeed([]);
        }
      }
    }
    fetchData();
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-500 bg-[#0a0f16]"><LoadingSpinner message="Loading..." /></div>;

  return (
    <div className="flex flex-col flex-1 relative bg-[#0a0f16] min-h-screen">
      {user ? (
        <Header user={user} />
      ) : (
        <PublicHeader onLogin={() => setShowLogin(true)} onRegister={() => setShowRegister(true)} />
      )}

      {user ? <DashboardView feed={feed} /> : <LandingView onRegister={() => setShowRegister(true)} />}

      <Footer />

      <AuthModals
        showLogin={showLogin}
        setShowLogin={setShowLogin}
        showRegister={showRegister}
        setShowRegister={setShowRegister}
      />
    </div>
  );
}
