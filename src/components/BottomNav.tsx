"use client";

import { useEffect, useState } from "react";
import { Home, Search, Trophy, User, Github, Plus } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

interface BottomNavProps {
  activeTab?: string;
  onTabChange?: (tab: any) => void;
  onSearchFocus?: () => void;
}

export default function BottomNav({ activeTab, onTabChange, onSearchFocus }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserSupabase();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      const session = data?.session;
      if (session?.user) {
        const login = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setUsername(login);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        const login = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setUsername(login);
      } else {
        setUsername(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleProfileClick = () => {
    if (username) {
      router.push(`/dev/${username}`);
    } else {
      // Direct redirect to server-side oauth route
      window.location.href = `/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  };

  const handlePostClick = () => {
    if (username) {
      if (pathname === "/" || pathname.startsWith("/dev/")) {
        const event = new CustomEvent("open-post-modal");
        window.dispatchEvent(event);
      } else {
        router.push("/?openPost=true");
      }
    } else {
      window.location.href = `/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  };


  const isHome = pathname === "/";
  const isProfile = pathname.startsWith("/dev/") || pathname.startsWith("/github/");

  const isHomeActive = isHome && (activeTab === "feed" || !activeTab);
  const isRankingsActive = isHome && activeTab === "leaderboard";

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a]/95 border-t border-[#334155]/40 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] flex items-center justify-around py-2 px-4 backdrop-blur-md">
      {/* Home Feed */}
      <button
        onClick={() => {
          if (!isHome) {
            router.push("/");
          } else if (onTabChange) {
            onTabChange("feed");
          }
        }}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
          isHomeActive ? "text-[#38bdf8]" : "text-[#94a3b8] hover:text-white"
        }`}
      >
        <Home className="h-5 w-5 transition-transform duration-200 active:scale-95" />
        <span>Home</span>
        <div className={`h-1 w-1 rounded-full bg-[#38bdf8] transition-all duration-200 ${isHomeActive ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
      </button>

      {/* Search */}
      <button
        onClick={() => {
          if (!isHome) {
            router.push("/?search=focus");
          } else if (onSearchFocus) {
            onSearchFocus();
          }
        }}
        className="flex flex-col items-center gap-0.5 text-[10px] font-bold tracking-wide text-[#94a3b8] hover:text-white transition-all duration-200"
      >
        <Search className="h-5 w-5 transition-transform duration-200 active:scale-95" />
        <span>Search</span>
        <div className="h-1 w-1 rounded-full bg-[#38bdf8] scale-0 opacity-0" />
      </button>

      {/* Create Post Button */}
      <button
        onClick={handlePostClick}
        className="flex flex-col items-center justify-center -mt-6 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#0f172a] p-3 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.45)] active:scale-90 transition-all duration-200 shrink-0"
        title="Create Post"
      >
        <Plus className="h-5 w-5 stroke-[3]" />
      </button>

      {/* Rankings */}
      <button
        onClick={() => {
          if (!isHome) {
            router.push("/");
            // wait a tiny bit for navigation and then trigger tab
            setTimeout(() => {
              const event = new CustomEvent("change-tab", { detail: "leaderboard" });
              window.dispatchEvent(event);
            }, 100);
          } else if (onTabChange) {
            onTabChange("leaderboard");
          }
        }}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
          isRankingsActive ? "text-[#38bdf8]" : "text-[#94a3b8] hover:text-white"
        }`}
      >
        <Trophy className="h-5 w-5 transition-transform duration-200 active:scale-95" />
        <span>Rankings</span>
        <div className={`h-1 w-1 rounded-full bg-[#38bdf8] transition-all duration-200 ${isRankingsActive ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
      </button>

      {/* Profile */}
      <button
        onClick={handleProfileClick}
        className={`flex flex-col items-center gap-0.5 text-[10px] font-bold tracking-wide transition-all duration-200 ${
          isProfile ? "text-[#38bdf8]" : "text-[#94a3b8] hover:text-white"
        }`}
      >
        {username ? (
          <User className="h-5 w-5 transition-transform duration-200 active:scale-95" />
        ) : (
          <Github className="h-5 w-5 transition-transform duration-200 active:scale-95" />
        )}
        <span>{username ? "Profile" : "Sign In"}</span>
        <div className={`h-1 w-1 rounded-full bg-[#38bdf8] transition-all duration-200 ${isProfile ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
      </button>
    </div>
  );
}
