"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer, ErrorMessage } from "@/components/shared";
import TurnstileWidget from "@/components/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile";

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    router.replace("/");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the captcha");
      return;
    }

    setSubmitting(true);
    try {
      await verifyTurnstileToken(turnstileToken);
      await signIn(email.trim(), password, rememberMe);
      router.push("/");
    } catch (err) {
      setError(err.message || "Could not log in");
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Log in
            </h1>
            <p className="text-stone-400 text-sm mt-2">
              Welcome back to Tornamesa
            </p>
          </div>

          <div className="bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl p-5 sm:p-7 shadow-xl">
            {error && (
              <ErrorMessage message={error} onDismiss={() => setError("")} />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="you@example.com"
                  className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••"
                  className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                  className="w-3.5 h-3.5 rounded border-[#2a3645] bg-[#0a121c]"
                />
                Remember me on this device
              </label>

              <div className="pt-1 flex justify-center min-h-[65px]">
                <TurnstileWidget
                  onToken={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#7cc7e8] text-[#0a121c] py-2.5 rounded-lg text-sm font-semibold hover:bg-[#a5d8f0] transition-all disabled:opacity-50 shadow-lg shadow-[#7cc7e8]/10"
              >
                {submitting ? "Signing in..." : "Log in"}
              </button>
            </form>

            <p className="text-center text-sm text-stone-400 mt-6">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/register"
                className="text-[#7cc7e8] hover:underline font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>

          <p className="text-center mt-6">
            <Link
              href="/"
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
            >
              ← Back to home
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
