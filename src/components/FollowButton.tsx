"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { UserPlus, UserMinus, UserCheck, Loader2, Github, AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

interface FollowButtonProps {
  targetUsername: string;
}

export default function FollowButton({ targetUsername }: FollowButtonProps) {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [session, setSession] = useState<any>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null); // null means loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  
  // Scope permission modal state
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch active session and check current follow status
  useEffect(() => {
    const fetchSessionAndStatus = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      setSession(s);

      if (s?.user) {
        const myLogin = (
          s.user.user_metadata?.user_name ??
          s.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setMyUsername(myLogin);

        // If viewing own profile, no follow button needed
        if (myLogin === targetUsername.toLowerCase()) {
          setIsFollowing(false); // we won't render it anyway
          return;
        }

        // Check follow status via our secure backend endpoint
        try {
          const res = await fetch(`/api/dev/${encodeURIComponent(targetUsername)}/follow`);
          const data = await res.json();
          setIsFollowing(!!data.isFollowing);
        } catch (err) {
          console.error("Error checking GitHub following status:", err);
          setIsFollowing(false);
        }
      } else {
        // Not logged in
        setIsFollowing(false);
      }
    };

    fetchSessionAndStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session?.user) {
        const myLogin = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setMyUsername(myLogin);
      } else {
        setMyUsername(null);
        setIsFollowing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, targetUsername]);

  // Hide button if not logged in or viewing own profile
  if (myUsername && myUsername === targetUsername.toLowerCase()) {
    return null;
  }

  // Handle follow click
  const handleFollowAction = async () => {
    if (!session?.user) {
      // Redirect to sign in if not logged in
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
      window.location.href = `/api/auth/github?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }

    setIsLoading(true);

    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(
        `/api/dev/${encodeURIComponent(targetUsername)}/follow`,
        { method }
      );

      if (res.ok) {
        const nextState = !isFollowing;
        setIsFollowing(nextState);
        window.dispatchEvent(
          new CustomEvent("follow-status-changed", {
            detail: { isFollowing: nextState },
          })
        );
      } else if (res.status === 403 || res.status === 401) {
        // Scope permissions missing (GitHub returns 403 or 401 when token doesn't have follow scope)
        setShowScopeModal(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to update follow status: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Error toggling follow status:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerReauthForScope = () => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
    window.location.href = `/api/auth/github?redirect=${encodeURIComponent(currentPath)}`;
  };

  // 1. Loading State
  if (isFollowing === null || !mounted) {
    return (
      <button
        disabled
        className="border-2 border-[#dadde1] bg-[#f5f6f7] text-[#8a8d91] font-bold text-sm px-4 py-2 rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5 font-sans"
      >
        <Loader2 className="h-4 w-4 animate-spin text-[#8a8d91]" />
        Checking Follow...
      </button>
    );
  }

  // 2. Action buttons rendering
  let buttonClass = "";
  let icon = null;
  let text = "";

  if (isFollowing) {
    if (isHovered && !isLoading) {
      // Unfollow hover state
      buttonClass = "border-2 border-red-500 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700";
      icon = <UserMinus className="h-4 w-4" />;
      text = "Unfollow";
    } else {
      // Following standard state
      buttonClass = "border-2 border-[#1877f2] bg-[#e7f3ff] text-[#1877f2] hover:bg-[#d0e7ff]";
      icon = <UserCheck className="h-4 w-4" />;
      text = "Following";
    }
  } else {
    // Follow standard state (Not following)
    buttonClass = "border-2 border-black bg-black hover:bg-neutral-800 text-white shadow-md active:scale-95";
    icon = <UserPlus className="h-4 w-4" />;
    text = "Follow";
  }

  return (
    <>
      <button
        onClick={handleFollowAction}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${buttonClass} font-bold text-sm px-5 py-2 rounded-md transition-all shadow-sm inline-flex items-center gap-1.5 font-sans cursor-pointer duration-200 disabled:opacity-50`}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {isLoading ? (isFollowing ? "Unfollowing..." : "Following...") : text}
      </button>

      {/* React Portal Scope Request Modal */}
      {showScopeModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300 animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setShowScopeModal(false)} />
          <div className="relative bg-white border border-[#dadde1] w-full max-w-md rounded-lg shadow-2xl overflow-hidden z-10 flex flex-col animate-in slide-in-from-bottom-8 duration-200 p-6">
            <button
              onClick={() => setShowScopeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 hover:bg-[#e4e6eb] rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 rounded-full text-amber-600 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 font-sans">
                GitHub Permissions Required
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-6 font-sans">
              To follow <strong>@{targetUsername}</strong> directly from Git Social, we need one-click following permission on your GitHub account.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={triggerReauthForScope}
                className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs py-3 px-4 rounded-md transition-all flex items-center justify-center gap-2 shadow-sm font-sans"
              >
                <Github className="h-4 w-4" />
                Enable One-Click Follow
              </button>
              <a
                href={`https://github.com/${targetUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowScopeModal(false)}
                className="w-full bg-white hover:bg-gray-50 border border-[#ccd0d5] text-gray-700 font-bold text-xs py-3 px-4 rounded-md transition-all flex items-center justify-center gap-2 shadow-sm font-sans"
              >
                <Github className="h-4 w-4" />
                Follow Directly on GitHub.com
              </a>
              <button
                onClick={() => setShowScopeModal(false)}
                className="w-full bg-transparent hover:bg-gray-100 text-gray-500 font-semibold text-xs py-2 px-4 rounded-md transition-all font-sans mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
