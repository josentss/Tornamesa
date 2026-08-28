"use client";

import FollowListClient from "@/components/profile/FollowListClient";

export default function FollowersPage({ params }) {
  return (
    <FollowListClient
      username={params?.username ?? params}
      initialTab="followers"
    />
  );
}
