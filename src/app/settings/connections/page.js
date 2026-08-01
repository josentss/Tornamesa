"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";

function ConnectionsContent() {
  const { user } = useAuth();
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [connectedAs, setConnectedAs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    fetch(`/api/connections/lastfm?userId=${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.username) {
          setConnectedAs(d.username);
          setLastfmUsername(d.username);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!user?.id || !lastfmUsername.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/connections/lastfm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          lastfmUsername: lastfmUsername.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error connecting");

      setConnectedAs(data.username);
      setStatus({ type: "success", text: "Last.fm linked successfully!" });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.message || "Failed to connect to Last.fm.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/connections/lastfm?userId=${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error disconnecting");
      }
      setConnectedAs(null);
      setLastfmUsername("");
      setStatus({ type: "success", text: "Disconnected from Last.fm" });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.message || "Error disconnecting",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#131b26] p-6 rounded-lg border border-[#1e293b]">
      <h2 className="text-lg font-bold mb-4 text-[#f0f9ff]">
        Service Connections
      </h2>

      {status && (
        <div
          className={`p-4 mb-6 rounded-lg text-sm font-bold ${
            status.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="p-5 bg-[#0a0f16] border border-[#1e293b] rounded-lg space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#d51007] rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm">
            FM
          </div>
          <div>
            <h3 className="font-bold text-[#f0f9ff]">Last.fm</h3>
            <p className="text-xs text-stone-400 mt-1">
              Link your Last.fm username to show what you&apos;re listening to
              on your profile. Enable scrobbling from Spotify (or another
              player) in your Last.fm settings.
            </p>
          </div>
        </div>

        {connectedAs ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-sm text-stone-300">
              Connected as{" "}
              <a
                href={`https://www.last.fm/user/${connectedAs}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#87ceeb] font-bold hover:underline"
              >
                @{connectedAs}
              </a>
            </p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-sm font-bold text-red-400 hover:text-red-300 disabled:opacity-50 self-start sm:self-auto"
            >
              {loading ? "..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleConnect}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <input
              type="text"
              value={lastfmUsername}
              onChange={(e) => setLastfmUsername(e.target.value)}
              placeholder="Your Last.fm username"
              className="flex-1 bg-[#131b26] border border-[#1e293b] rounded p-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#87ceeb] transition-colors"
              disabled={loading || !user?.id}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !user?.id || !lastfmUsername.trim()}
              className="bg-[#d51007] hover:bg-[#e3120b] text-white text-sm font-bold py-2.5 px-5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Connect"}
            </button>
          </form>
        )}
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
