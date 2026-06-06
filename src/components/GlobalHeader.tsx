"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { 
  Search, 
  User, 
  LogOut, 
  Github,
  Award,
  Globe,
  X,
  TrendingUp,
  History,
  Code
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase, triggerGitHubLogin } from "@/lib/supabase";
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

  // Mobile Search Overlay State
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Keep search input synced with URL search param
  useEffect(() => {
    setHeaderSearch(searchParams.get("search") || "");
  }, [searchParams]);

  // Hide Capacitor Splash Screen on client mount
  useEffect(() => {
    import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => {
        SplashScreen.hide().catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Listen for native deep link URL open events (OAuth callbacks)
  useEffect(() => {
    import("@capacitor/app")
      .then(({ App }) => {
        App.addListener("appUrlOpen", async (event: any) => {
          try {
            const urlStr = event.url;
            // Normalize URL format to easily parse query or hash parameters
            const normalizedUrl = urlStr.replace("#", "?");
            const urlObj = new URL(normalizedUrl);

            // 1. Handle PKCE code exchange directly in the app where the verifier is stored
            const code = urlObj.searchParams.get("code");
            if (code) {
              try {
                const { Browser } = await import("@capacitor/browser");
                await Browser.close();
              } catch (browserErr) {
                console.warn("Could not close capacitor browser:", browserErr);
              }

              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error) {
                router.refresh();
              } else {
                console.error("Deep link PKCE exchange failed:", error.message);
              }
              return;
            }

            // 2. Handle access token / refresh token fallback
            const access_token = urlObj.searchParams.get("access_token");
            const refresh_token = urlObj.searchParams.get("refresh_token");
            
            if (access_token && refresh_token) {
              // Attempt to close the Capacitor Browser custom tab if it's open
              try {
                const { Browser } = await import("@capacitor/browser");
                await Browser.close();
              } catch (browserErr) {
                console.warn("Could not close capacitor browser:", browserErr);
              }

              const { error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              if (!error) {
                router.refresh();
              } else {
                console.error("Deep link auth failed:", error.message);
              }
            }
          } catch (err) {
            console.error("Error handling deep link:", err);
          }
        });
      })
      .catch(() => {});
  }, [supabase, router]);

  // Listen for mobile search trigger
  useEffect(() => {
    const handleToggleSearch = () => {
      setIsMobileSearchOpen((prev) => !prev);
    };
    const handleCloseSearch = () => {
      setIsMobileSearchOpen(false);
    };

    window.addEventListener("toggle-search-overlay", handleToggleSearch);
    window.addEventListener("close-search-overlay", handleCloseSearch);

    // Also check url query params for focus trigger
    const searchParam = searchParams.get("search");
    if (searchParam === "focus") {
      setIsMobileSearchOpen(true);
    }

    return () => {
      window.removeEventListener("toggle-search-overlay", handleToggleSearch);
      window.removeEventListener("close-search-overlay", handleCloseSearch);
    };
  }, [searchParams]);

  // Load recent searches when mobile search opens
  useEffect(() => {
    if (isMobileSearchOpen && typeof window !== "undefined") {
      try {
        const searches = JSON.parse(localStorage.getItem("gitsocial_recent_searches") || "[]");
        setRecentSearches(searches);
      } catch (e) {
        console.error("Failed to load recent searches", e);
      }
    }
  }, [isMobileSearchOpen]);

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

  const saveToRecentSearches = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
      const searches = JSON.parse(localStorage.getItem("gitsocial_recent_searches") || "[]");
      const updated = [trimmed, ...searches.filter((s: string) => s !== trimmed)].slice(0, 5);
      localStorage.setItem("gitsocial_recent_searches", JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignIn = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
    await triggerGitHubLogin(supabase, currentPath);
  };

  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/");
      setIsMobileSearchOpen(false);
      return;
    }

    saveToRecentSearches(trimmed);

    // Check if the query is a potential profile search
    // (starts with '@' or is a single word matching GitHub username format)
    const isProfileSearch = trimmed.startsWith("@") || /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(trimmed);

    if (isProfileSearch) {
      const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
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
          setIsMobileSearchOpen(false);
          return;
        }

        // 2. If it starts with '@', route directly to GitHub profile viewer
        if (trimmed.startsWith("@")) {
          router.push(`/github/${lowerUsername}`);
          setIsMobileSearchOpen(false);
          return;
        }

        // 3. For single words without '@', check if the user exists on GitHub
        const githubRes = await fetch(`https://api.github.com/users/${encodeURIComponent(lowerUsername)}`);
        if (githubRes.ok) {
          router.push(`/github/${lowerUsername}`);
          setIsMobileSearchOpen(false);
          return;
        }
      } catch (err) {
        console.error("Global search error:", err);
      }
    }

    // Fallback to post search on home page
    router.push(`/?search=${encodeURIComponent(trimmed)}`);
    setIsMobileSearchOpen(false);
  };

  const triggerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(headerSearch);
  };

  return (
    <header 
      className="sticky top-0 z-50 bg-[#3b5998] text-white border-b border-[#29487d] shadow-sm relative safe-top-padding"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
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
          <Link
            href="/workspace"
            className="hover:bg-[#4e69a2] px-2 py-1.5 rounded-md transition-colors flex items-center gap-1.5 border border-white/10"
            title="Workspace Editor"
          >
            <Code className="h-4 w-4 text-blue-200" />
            <span className="text-sm font-semibold hidden md:inline-block font-sans">Workspace</span>
          </Link>

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
            <button
              onClick={handleSignIn}
              className="bg-white hover:bg-gray-50 text-[#3b5998] font-bold text-xs px-3.5 py-1.5 rounded-md shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Github className="h-4 w-4" />
              <span className="font-sans">Log In</span>
            </button>
          )}
        </div>

      </div>

      {/* Beautiful Glassmorphic Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col md:hidden animate-in fade-in duration-200">
          {/* Header Container */}
          <div className="p-4 border-b border-slate-800/60 flex items-center gap-3">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(mobileSearchQuery);
              }} 
              className="flex-1 relative"
            >
              <input
                type="text"
                placeholder="Search posts or @username..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 text-white placeholder-slate-400 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-base focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all font-sans"
                autoFocus
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-sky-400" />
            </form>
            <button 
              onClick={() => setIsMobileSearchOpen(false)}
              className="text-slate-400 hover:text-white font-medium text-sm px-2 py-1.5 rounded-lg active:scale-95 transition-all font-sans"
            >
              Cancel
            </button>
          </div>

          {/* Content Container */}
          <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            
            {/* Pro tip / Helper banner */}
            <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <div className="bg-sky-500/20 p-1.5 rounded-lg text-sky-400 shrink-0">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-sky-300 font-sans">Pro Search Tip</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">
                  Type <code className="bg-slate-900/60 px-1 py-0.5 rounded text-sky-400 font-semibold font-mono">@username</code> to go straight to a developer profile, or keywords to filter posts.
                </p>
              </div>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <History className="h-3.5 w-3.5" />
                    Recent Searches
                  </h3>
                  <button 
                    onClick={() => {
                      localStorage.removeItem("gitsocial_recent_searches");
                      setRecentSearches([]);
                    }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors font-sans"
                  >
                    Clear All
                  </button>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {recentSearches.map((search, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5">
                      <button
                        onClick={() => {
                          setMobileSearchQuery(search);
                          runSearch(search);
                        }}
                        className="flex-1 text-left text-sm text-slate-200 hover:text-sky-400 transition-colors font-sans truncate pr-4 cursor-pointer"
                      >
                        {search}
                      </button>
                      <button
                        onClick={() => {
                          const updated = recentSearches.filter((_, i) => i !== idx);
                          localStorage.setItem("gitsocial_recent_searches", JSON.stringify(updated));
                          setRecentSearches(updated);
                        }}
                        className="text-slate-500 hover:text-slate-300 p-1 rounded-md transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explore / Popular Searches */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <TrendingUp className="h-3.5 w-3.5" />
                Popular Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "@samuelrizzondev", value: "@samuelrizzondev" },
                  { label: "@octocat", value: "@octocat" },
                  { label: "JavaScript", value: "JavaScript" },
                  { label: "Rust", value: "Rust" },
                  { label: "Next.js", value: "Next.js" },
                  { label: "Supabase", value: "Supabase" },
                  { label: "Three.js", value: "Three.js" },
                ].map((tag, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setMobileSearchQuery(tag.value);
                      runSearch(tag.value);
                    }}
                    className="bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 rounded-full px-3.5 py-1.5 text-xs text-slate-300 hover:text-white active:scale-95 transition-all duration-150 flex items-center gap-1 font-sans cursor-pointer"
                  >
                    {tag.label.startsWith("@") ? (
                      <span className="text-sky-400 font-medium">@</span>
                    ) : (
                      <span className="text-slate-500">#</span>
                    )}
                    {tag.label.startsWith("@") ? tag.label.substring(1) : tag.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
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
