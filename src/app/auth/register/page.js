"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage } from "@/components/shared";
import TurnstileWidget from "@/components/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile";

export default function RegisterPage() {
  const { signUp, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanUser = username.trim().toLowerCase();
    if (!email.trim() || !cleanUser || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
      setError(
        "Username must be 3–20 characters (letters, numbers, underscore)"
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must have at least 6 characters");
      return;
    }
    if (!acceptTerms) {
      setError("You must accept the terms of service");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the captcha");
      return;
    }

    setSubmitting(true);
    try {
      // Username taken?
      try {
        const res = await fetch(
          `/api/profiles/username/${encodeURIComponent(cleanUser)}`
        );
        if (res.ok) {
          setError("This username is already taken");
          setSubmitting(false);
          return;
        }
      } catch {
        /* network — continue */
      }

      await verifyTurnstileToken(turnstileToken);
      await signUp(email.trim(), password, cleanUser);
      setSuccess("Account created. You can log in now.");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err) {
      setError(err.message || "Could not create account");
      setTurnstileToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Create account
          </h1>
          <p className="text-stone-400 text-sm mt-2">Join Tornamesa</p>
        </div>

        <div className="bg-[#131e2c]/90 border border-[#2a3645] rounded-2xl p-5 sm:p-7 shadow-xl">
          {error && (
            <ErrorMessage message={error} onDismiss={() => setError("")} />
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-800 text-green-300 text-sm rounded-xl">
              ✓ {success}
            </div>
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
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                placeholder="yourname"
                className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors"
              />
              <p className="text-[10px] text-stone-600 mt-1">
                3–20 characters: a–z, 0–9, underscore
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••"
                  className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1.5">
                  Confirm
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="••••••••"
                  className="w-full bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-[#7cc7e8] transition-colors"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer text-xs text-stone-400">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-3.5 h-3.5 rounded border-[#2a3645] bg-[#0a121c]"
              />
              <span>I accept the terms of service and privacy policy.</span>
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
              {submitting ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p className="text-center text-sm text-stone-400 mt-6">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-[#7cc7e8] hover:underline font-medium"
            >
              Log in
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
  );
}
