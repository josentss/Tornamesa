"use client";

import { useAuth } from "@/context/AuthContext";
import { Header, Footer, LoadingSpinner } from "@/components/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsLayout({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <LoadingSpinner message="Loading settings..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16]">
        <LoadingSpinner message="Redirecting..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        {/* Navigation Tabs */}
        <div className="flex gap-6 mb-6 border-b border-[#1e293b]">
          <Link
            href="/settings/profile"
            className={`pb-3 text-sm font-bold transition-colors border-b-2 ${
              pathname === "/settings/profile"
                ? "border-[#87ceeb] text-[#87ceeb]"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            Profile
          </Link>
          <Link
            href="/settings/connections"
            className={`pb-3 text-sm font-bold transition-colors border-b-2 ${
              pathname === "/settings/connections"
                ? "border-[#87ceeb] text-[#87ceeb]"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            Connections
          </Link>
        </div>

        {children}
      </main>

      <Footer />
    </div>
  );
}
