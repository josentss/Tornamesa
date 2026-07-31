"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";

function ConnectionsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    if (!searchParams) return;

    const status = searchParams.get("connection");
    const err = searchParams.get("error");

    if (status === "success") {
      setConnectionStatus({
        type: "success",
        text: "Spotify account linked successfully!",
      });
    } else if (err) {
      setConnectionStatus({
        type: "error",
        text: "Failed to connect to Spotify.",
      });
    }
  }, [searchParams]);

  const handleConnectSpotify = () => {
    if (!user?.id) return;

    // Misma origen (monorepo) → Route Handler de Next.js
    window.location.href = `/api/auth/spotify/login?userId=${user.id}`;
  };

  return (
    <div className="bg-[#131b26] p-6 rounded-lg border border-[#1e293b]">
      <h2 className="text-lg font-bold mb-4 text-[#f0f9ff]">
        Service Connections
      </h2>

      {connectionStatus && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-bold ${
            connectionStatus.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {connectionStatus.text}
        </div>
      )}

      <div className="flex items-center justify-between p-5 bg-[#0a0f16] border border-[#1e293b] rounded-lg transition-colors hover:border-[#87ceeb]/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1db954] rounded-full flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 512 512"
              aria-hidden="true"
            >
              <path
                fill="#1ed760"
                d="M256 0C114.7 0 0 114.7 0 256s114.7 256 256 256s256-114.7 256-256S397.3 0 256 0"
              />
              <path
                fill="#000"
                d="M419.7 230.3c-5.4 0-8.7-1.3-13.3-4c-73.5-43.9-204.9-54.4-290-30.7c-3.7 1-8.4 2.7-13.3 2.7c-13.6 0-24.1-10.6-24.1-24.4c0-14 8.7-22 18-24.7c36.3-10.6 77-15.7 121.3-15.7c75.4 0 154.3 15.7 212 49.3c8.1 4.6 13.3 11 13.3 23.3c.1 14.2-11.3 24.2-23.9 24.2m-32 78.7c-5.4 0-9-2.4-12.7-4.3c-64.5-38.2-160.7-53.6-246.3-30.3c-5 1.3-7.6 2.7-12.3 2.7c-11 0-20-9-20-20s5.4-18.4 16-21.4c28.7-8.1 58-14 101-14c67 0 131.7 16.6 182.7 47c8.4 5 11.7 11.4 11.7 20.3c-.2 11-8.8 20-20.1 20m-27.8 67.7c-4.3 0-7-1.3-11-3.7c-64.4-38.8-139.4-40.5-213.4-25.3c-4 1-9.3 2.7-12.3 2.7c-10 0-16.3-7.9-16.3-16.3c0-10.6 6.3-15.7 14-17.3c84.5-18.7 170.9-17 244.6 27c6.3 4 10 7.6 10 17s-7.2 15.9-15.6 15.9"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-[#f0f9ff]">Spotify</h3>
            <p className="text-xs text-stone-400 mt-1">
              Connect your account to show what you&apos;re listening to in
              real-time.
            </p>
          </div>
        </div>

        <button
          onClick={handleConnectSpotify}
          disabled={!user?.id}
          className="bg-[#1db954] hover:bg-[#1ed760] text-black text-sm font-bold py-2 px-5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Connect Account
        </button>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-stone-400 text-sm">Loading connections...</div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
