"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

interface Props {
  githubLogin: string;
  claimed: boolean;
}

export default function ClaimButton({ githubLogin, claimed }: Props) {
  const [isClaimed, setIsClaimed] = useState(claimed);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      if (!user) return;
      const login = (
        user.user_metadata.user_name ??
        user.user_metadata.preferred_username ??
        ""
      ).toLowerCase();
      setIsOwner(login === githubLogin.toLowerCase());
    });
  }, [githubLogin]);

  if (isClaimed) {
    return (
      <div className="inline-flex items-center justify-center border-2 border-black p-[2px] rounded-md bg-white select-none">
        <div className="flex items-center justify-center border border-black px-3 py-1 text-[10px] font-extrabold tracking-wider text-black rounded-sm uppercase bg-white">
          CLAIMED
        </div>
      </div>
    );
  }

  if (!isOwner) return null;

  async function handleClaim() {
    setLoading(true);
    try {
      const res = await fetch("/api/claim", { method: "POST" });
      if (res.ok) setIsClaimed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClaim}
      disabled={loading}
      className="btn-press flex items-center justify-center gap-1.5 border-2 border-black px-4 py-2 text-[10px] text-black font-extrabold uppercase tracking-wider hover:bg-gray-50 rounded-md transition-colors disabled:opacity-40 cursor-pointer animate-none"
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {loading ? "Claiming..." : "Claim"}
    </button>
  );
}
