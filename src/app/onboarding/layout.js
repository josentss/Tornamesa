"use client";

import Link from "next/link";

export default function OnboardingLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-[#f0f9ff] flex flex-col">
      <header className="border-b border-[#2a3645] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tighter text-[#f0f9ff]"
          >
            Tornamesa
          </Link>
          <span className="text-xs text-stone-500 uppercase tracking-wider">
            Setup
          </span>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
