"use client";

import { useState, useEffect } from "react";

interface FollowStatsProps {
  targetUsername: string;
  initialFollowers: number;
  initialFollowing: number;
}

export default function FollowStats({ targetUsername, initialFollowers, initialFollowing }: FollowStatsProps) {
  const [followersCount, setFollowersCount] = useState(initialFollowers);

  useEffect(() => {
    const handleFollowChange = (e: any) => {
      const isFollowingNext = e.detail.isFollowing;
      setFollowersCount((prev) => (isFollowingNext ? prev + 1 : Math.max(0, prev - 1)));
    };

    window.addEventListener("follow-status-changed", handleFollowChange);
    return () => window.removeEventListener("follow-status-changed", handleFollowChange);
  }, []);

  return (
    <div className="flex items-center justify-center md:justify-start gap-3.5 text-xs text-[#65676b] font-medium mt-3 select-none">
      <a 
        href={`https://github.com/${targetUsername}?tab=followers`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline hover:text-[#1877f2] transition-colors"
      >
        <span className="font-bold text-[#1c1e21] text-sm">{followersCount.toLocaleString()}</span> followers
      </a>
      <div className="h-3 w-px bg-gray-300" />
      <a
        href={`https://github.com/${targetUsername}?tab=following`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline hover:text-[#1877f2] transition-colors"
      >
        <span className="font-bold text-[#1c1e21] text-sm">{initialFollowing.toLocaleString()}</span> following
      </a>
    </div>
  );
}
