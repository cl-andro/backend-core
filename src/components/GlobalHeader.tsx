"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { 
  Search, 
  User, 
  LogOut, 
  Github,
  Award,
  Globe
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function GlobalHeaderContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabase();

  // Authentication State
  const [session, setSession] = useState<Session | null>(null);
  const [currentDev, setCurrentDev] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Search State
  const initialSearch = searchParams.get("search") || "";
  const [headerSearch, setHeaderSearch] = useState(initialSearch);
  const [isNavigating, setIsNavigating] = useState(false);

  // Keep search input synced with URL search param
  useEffect(() => {
    setHeaderSearch(searchParams.get("search") || "");
  }, [searchParams]);

  // Global Navigation & Tab Caching progress bar trigger
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // 1. Manage Supabase Session
  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      const s = res.data?.session;
      setSession(s ?? null);
      setAuthLoading(false);
      if (s?.provider_token) {
        localStorage.setItem("gh_provider_token", s.provider_token);
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerToken: s.provider_token }),
        }).catch(() => {});
      }
    }).catch((err: any) => {
      console.error("GlobalHeader getSession error: ", err);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      setAuthLoading(false);
      if (session?.provider_token) {
        localStorage.setItem("gh_provider_token", session.provider_token);
        fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerToken: session.provider_token }),
        }).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // 2. Fetch Logged-in Developer Profile
  useEffect(() => {
    if (session?.user) {
      const login = (
        session.user.user_metadata?.user_name ??
        session.user.user_metadata?.preferred_username ??
        ""
      ).toLowerCase();

      supabase
        .from("developers")
        .select("*")
        .eq("github_login", login)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setCurrentDev(data);
          }
        }).catch((err: any) => {
          console.error("GlobalHeader fetch profile error: ", err);
        });
    } else {
      setCurrentDev(null);
    }
  }, [session, supabase]);

  const triggerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = headerSearch.trim();
    if (!query) {
      router.push("/");
      return;
    }

    // Check if the query is a potential profile search
    // (starts with '@' or is a single word matching GitHub username format)
    const isProfileSearch = query.startsWith("@") || /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(query);

    if (isProfileSearch) {
      const username = query.startsWith("@") ? query.slice(1) : query;
      const lowerUsername = username.toLowerCase();

      try {
        // 1. Check if the developer exists in Supabase
        const { data } = await supabase
          .from("developers")
          .select("github_login")
          .eq("github_login", lowerUsername)
          .maybeSingle();

        if (data) {
          router.push(`/dev/${lowerUsername}`);
          return;
        }

        // 2. If it starts with '@', route directly to GitHub profile viewer
        if (query.startsWith("@")) {
          router.push(`/github/${lowerUsername}`);
          return;
        }

        // 3. For single words without '@', check if the user exists on GitHub
        const githubRes = await fetch(`https://api.github.com/users/${encodeURIComponent(lowerUsername)}`);
        if (githubRes.ok) {
          router.push(`/github/${lowerUsername}`);
          return;
        }
      } catch (err) {
        console.error("Global search error:", err);
      }
    }

    // Fallback to post search on home page
    router.push(`/?search=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#3b5998] text-white border-b border-[#29487d] shadow-sm relative">
      {/* Global Shimmer Loading Progress Bar */}
      <div className={`absolute bottom-0 left-0 w-full h-[3px] bg-[#3b5998] overflow-hidden transition-opacity duration-300 z-50 ${
        isNavigating ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}>
        <div className="h-full bg-amber-400 animate-shimmer-loading w-1/2" />
      </div>

      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center justify-between gap-4">
        
        {/* Logo (routes to Home) */}
        <Link href="/" className="flex items-center gap-2 select-none hover:opacity-95">
          <Image
            src="/icon-192.png"
            alt="Logo"
            width={32}
            height={32}
            className="rounded-sm bg-white"
          />
          <span className="font-bold text-lg tracking-tight hidden sm:inline-block font-sans">
            Git Social
          </span>
          <span className="bg-[#4e69a2] text-xs px-1.5 py-0.5 rounded font-mono ml-1.5 hidden md:inline-block">
            Lite v2.0
          </span>
        </Link>

        {/* Global Search Bar */}
        <form onSubmit={triggerSearch} className="flex-1 max-w-md flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search posts or @username..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              className="w-full bg-[#4e69a2] placeholder-blue-200 border-none rounded-md text-sm px-3 py-1.5 pl-9 focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200" />
          </div>
        </form>

        {/* User Auth Section */}
        <div className="flex items-center gap-4">
          {authLoading ? (
            <div className="animate-pulse h-8 w-16 bg-[#4e69a2] rounded-md" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href={currentDev ? `/github/${currentDev.github_login}` : "/"}
                className="flex items-center gap-2 hover:bg-[#4e69a2] px-2 py-1.5 rounded-md transition-colors"
              >
                {currentDev?.avatar_url ? (
                  <img
                    src={currentDev.avatar_url}
                    alt={currentDev.github_login}
                    className="h-6 w-6 rounded-full border border-white/20"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="text-sm font-semibold hidden md:inline-block font-sans">
                  {currentDev?.name || currentDev?.github_login}
                </span>
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/");
                }}
                className="hover:bg-[#4e69a2] p-1.5 rounded-md transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/github"
              className="bg-white hover:bg-gray-50 text-[#3b5998] font-bold text-xs px-3.5 py-1.5 rounded-md shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              <span className="font-sans">Log In</span>
            </a>
          )}
        </div>

      </div>
    </header>
  );
}

export default function GlobalHeader() {
  return (
    <Suspense fallback={
      <header className="bg-[#3b5998] text-white border-b border-[#29487d] py-2 shadow-sm">
        <div className="mx-auto max-w-6xl px-3 flex justify-between items-center">
          <img src="/icon-192.png" alt="Logo" width={32} height={32} className="rounded-sm bg-white" />
          <div className="h-8 w-16 bg-[#4e69a2] rounded-md animate-pulse" />
        </div>
      </header>
    }>
      <GlobalHeaderContent />
    </Suspense>
  );
}
