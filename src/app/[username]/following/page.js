"use client";

import FollowListClient from "@/components/profile/FollowListClient";

export default function FollowingPage({ params }) {
  return (
    <FollowListClient
      username={params?.username ?? params}
      initialTab="following"
    />
  );
}
