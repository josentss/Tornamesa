"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Header, Footer } from "@/components/shared";
import LandingView, { PublicHeader } from "@/components/home/LandingView";
import DashboardView from "@/components/home/DashboardView";

export default function HomeClient({ initialLoggedIn = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [feed, setFeed] = useState([]);
  const [ownHistory, setOwnHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [friendsReviews, setFriendsReviews] = useState([]);
  const [username, setUsername] = useState(null);
  const [monthlyTop, setMonthlyTop] = useState([]);
  const [toListen, setToListen] = useState(null);
  const [dataReady, setDataReady] = useState(false);

  const showDashboard = Boolean(user) || (loading && initialLoggedIn);
  const needsOnboarding =
    user && user.onboarding_completed === false;

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  useEffect(() => {
    if (!user?.id) {
      setFeed([]);
      setOwnHistory([]);
      setStats(null);
      setFriendsReviews([]);
      setUsername(null);
      setMonthlyTop([]);
      setToListen(null);
      setDataReady(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setDataReady(false);

        const core = Promise.all([
          api.getUserHistory(user.id, 30, 0).catch(() => []),
          api.getFriendsFeed(user.id).catch(() => []),
          api.getUserStats?.(user.id).catch(() => null) ||
            Promise.resolve(null),
          api.getFriendsReviews(user.id).catch(() => []),
        ]).then(([history, friendsFeed, userStats, reviews]) => {
          if (cancelled) return;
          setOwnHistory(
            Array.isArray(history)
              ? history
              : history?.history || history?.listens || []
          );
          setFeed(
            Array.isArray(friendsFeed)
              ? friendsFeed
              : friendsFeed?.feed || []
          );
          setStats(userStats);
          setFriendsReviews(
            Array.isArray(reviews)
              ? reviews
              : reviews?.reviews || []
          );
          setUsername(user.username || null);
          setDataReady(true);
        });

        const secondary = Promise.all([
          user.username
            ? api
                .getMonthlyTop(user.username, {
                  year: new Date().getUTCFullYear(),
                  month: new Date().getUTCMonth() + 1,
                })
                .catch(() => null)
            : Promise.resolve(null),
          api.getUserLists(user.id).catch(() => []),
        ]).then(async ([topRes, listsRes]) => {
          if (cancelled) return;

          const topEntries =
            topRes?.entries ||
            topRes?.albums ||
            topRes?.top ||
            topRes ||
            [];
          setMonthlyTop(Array.isArray(topEntries) ? topEntries : []);

          const lists = Array.isArray(listsRes)
            ? listsRes
            : listsRes?.lists || [];
          const systemList =
            lists.find(
              (l) =>
                l.isSystem === true ||
                l.is_system === true ||
                (l.name || "").toLowerCase() === "to listen"
            ) || null;

          if (!systemList?.id) {
            setToListen(null);
            return;
          }

          setToListen({
            id: systemList.id,
            itemCount: systemList.count ?? 0,
            items: [],
          });

          try {
            const full = await api.getList(systemList.id);
            if (cancelled) return;
            const items = full?.albums || full?.items || [];
            setToListen({
              id: systemList.id,
              itemCount:
                full?.list?.count ?? systemList.count ?? items.length,
              items: items
                .slice(0, 6)
                .map((it) => {
                  const alb = it.album || it;
                  return {
                    id: alb.id || alb.spotify_id || it.album_id,
                    album_id: alb.id || alb.spotify_id || it.album_id,
                    title: alb.title || it.title,
                    artist: alb.artist || it.artist,
                    cover: alb.cover || alb.cover_url || it.cover,
                  };
                })
                .filter((x) => x.id),
            });
          } catch {
          }
        });

        await Promise.all([core, secondary]);
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (!cancelled) setDataReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.onboarding_completed, initialLoggedIn]);

  if (needsOnboarding) {
    return <div className="min-h-screen bg-[#0a0f16]" />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-[#f0f9ff]">
      {showDashboard ? <Header user={user} /> : <PublicHeader />}

      {showDashboard ? (
        <DashboardView
          username={username}
          feed={feed}
          ownHistory={ownHistory}
          stats={stats}
          friendsReviews={friendsReviews}
          monthlyTop={monthlyTop}
          toListen={toListen}
          dataReady={dataReady}
        />
      ) : (
        <LandingView />
      )}

      <Footer />
    </div>
  );
}
