"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Header, Footer } from "@/components/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function SettingsLayout({ children }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  if (!user) {
    return <div className="min-h-screen bg-[#0a0f16]" />;
  }

  const tabs = [
    { href: "/settings/profile", label: "Profile" },
    { href: "/settings/account", label: "Account" },
    { href: "/settings/connections", label: "Connections" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      <Header user={user} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Account settings
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Manage your account, privacy and connections
          </p>
        </div>

        <nav className="flex gap-1 sm:gap-6 mb-8 border-b border-[#2a3645] overflow-x-auto">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pb-3 px-1 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  active
                    ? "border-[#7cc7e8] text-[#7cc7e8]"
                    : "border-transparent text-stone-500 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </main>

      <Footer />
    </div>
  );
}
