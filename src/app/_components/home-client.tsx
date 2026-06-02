"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { 
  ThumbsUp, 
  MessageSquare, 
  Search, 
  Send, 
  Home, 
  User, 
  LogOut, 
  Github, 
  Award, 
  Database,
  Code,
  Globe,
  Loader2,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Download
} from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { Assignment } from "@/lib/landmarks/types";
import BottomNav from "@/components/BottomNav";
import GitHubSearchBox from "@/components/GitHubSearchBox";
import MarkdownViewer from "@/components/MarkdownViewer";
import PostModal from "@/components/PostModal";


interface HomeClientProps {
  assignments: Assignment[];
}

// Zero-dependency relative time formatter
function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HomeClient({ assignments }: HomeClientProps) {
  const supabase = createBrowserSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchVal = searchParams.get("search") || "";

  // Authentication State
  const [session, setSession] = useState<Session | null>(null);
  const [currentDev, setCurrentDev] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Social Feed & Interaction State
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Feed recommendation state (For You / Latest)
  const [feedType, setFeedType] = useState<"for-you" | "latest">("for-you");
  
  // Refs for debouncing like actions (optimistic update queues)
  const likeTimeouts = useRef<Record<number, NodeJS.Timeout>>({});
  const originalLikes = useRef<Record<number, boolean>>({});
  const currentLikesRef = useRef<Record<number, boolean>>({});
  const originalLikesCount = useRef<Record<number, number>>({});

  // Post modal overlay state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // Link modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [textareaSelRange, setTextareaSelRange] = useState<{ start: number; end: number } | null>(null);

  // Export/Download states
  const [activeExportDropdown, setActiveExportDropdown] = useState<number | null>(null);
  const [exportingPostId, setExportingPostId] = useState<number | null>(null);
  const [isExportingComposer, setIsExportingComposer] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setIsPostModalOpen(true);
    window.addEventListener("open-post-modal", handleOpenModal);
    return () => window.removeEventListener("open-post-modal", handleOpenModal);
  }, []);

  // Handle redirect from other pages via ?openPost=true search parameter
  useEffect(() => {
    if (searchParams.get("openPost") === "true") {
      setIsPostModalOpen(true);
      const params = new URLSearchParams(window.location.search);
      params.delete("openPost");
      const newSearch = params.toString();
      router.replace(newSearch ? `/?${newSearch}` : "/");
    }
  }, [searchParams, router]);



  const handleFormat = (type: "bold" | "italic" | "code" | "codeblock" | "link" | "quote" | "bullet" | "ordered" | "task") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let insertion = "";
    let selectionOffsetStart = 0;
    let selectionOffsetEnd = 0;

    switch (type) {
      case "bold":
        if (selectedText) {
          insertion = `**${selectedText}**`;
          selectionOffsetStart = 2;
          selectionOffsetEnd = insertion.length - 2;
        } else {
          insertion = `****`;
          selectionOffsetStart = 2;
          selectionOffsetEnd = 2;
        }
        break;
      case "italic":
        if (selectedText) {
          insertion = `*${selectedText}*`;
          selectionOffsetStart = 1;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `**`;
          selectionOffsetStart = 1;
          selectionOffsetEnd = 1;
        }
        break;
      case "code":
        if (selectedText) {
          insertion = `\`${selectedText}\``;
          selectionOffsetStart = 1;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `\`\``;
          selectionOffsetStart = 1;
          selectionOffsetEnd = 1;
        }
        break;
      case "codeblock":
        if (selectedText) {
          insertion = `\n\`\`\`\n${selectedText}\n\`\`\`\n`;
          selectionOffsetStart = 5;
          selectionOffsetEnd = insertion.length - 5;
        } else {
          insertion = `\n\`\`\`\n\n\`\`\`\n`;
          selectionOffsetStart = 5;
          selectionOffsetEnd = 5;
        }
        break;
      case "link":
        setTextareaSelRange({ start, end });
        setLinkText(selectedText);
        setLinkUrl("");
        setLinkModalOpen(true);
        return;
      case "quote":
        if (selectedText) {
          insertion = `\n> ${selectedText}\n`;
          selectionOffsetStart = 3;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `\n> `;
          selectionOffsetStart = 3;
          selectionOffsetEnd = 3;
        }
        break;
      case "bullet":
        if (selectedText) {
          insertion = `\n- ${selectedText}`;
          selectionOffsetStart = 3;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n- `;
          selectionOffsetStart = 3;
          selectionOffsetEnd = 3;
        }
        break;
      case "ordered":
        if (selectedText) {
          insertion = `\n1. ${selectedText}`;
          selectionOffsetStart = 4;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n1. `;
          selectionOffsetStart = 4;
          selectionOffsetEnd = 4;
        }
        break;
      case "task":
        if (selectedText) {
          insertion = `\n- [ ] ${selectedText}`;
          selectionOffsetStart = 8;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n- [ ] `;
          selectionOffsetStart = 7;
          selectionOffsetEnd = 7;
        }
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + insertion + text.substring(end);
    setPostContent(newText);

    // Restore selection/focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + selectionOffsetStart, start + selectionOffsetEnd);
    }, 0);
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea || !textareaSelRange) {
      setLinkModalOpen(false);
      return;
    }

    const { start, end } = textareaSelRange;
    const text = textarea.value;
    const url = linkUrl.trim() || "https://";
    const displayName = linkText.trim() || "link text";
    
    const insertion = `[${displayName}](${url})`;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setPostContent(newText);
    setLinkModalOpen(false);
    setTextareaSelRange(null);
    setLinkUrl("");
    setLinkText("");

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + displayName.length);
    }, 0);
  };

  const handleTextareaSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const PLACEHOLDERS = [
      "task item",
      "bold text",
      "italic text",
      "code block",
      "link text",
      "quote",
      "list item"
    ];

    if (start === end) {
      // Check standard placeholders
      for (const placeholder of PLACEHOLDERS) {
        let index = -1;
        while ((index = val.indexOf(placeholder, index + 1)) !== -1) {
          if (start >= index && start <= index + placeholder.length) {
            textarea.setSelectionRange(index, index + placeholder.length);
            return;
          }
        }
      }

      // Check for raw 'https://' placeholder inside link brackets e.g. '(https://)'
      let index = -1;
      const target = "https://";
      while ((index = val.indexOf(target, index + 1)) !== -1) {
        if (val.charAt(index + target.length) === ")") {
          if (start >= index && start <= index + target.length) {
            textarea.setSelectionRange(index, index + target.length);
            return;
          }
        }
      }
    }
  };

  const handleExportPost = async (postId: number, type: 'png' | 'pdf') => {
    const cardElement = document.getElementById(`post-card-${postId}`);
    if (!cardElement) return;

    setExportingPostId(postId);
    try {
      cardElement.classList.add('exporting-mode');
      await new Promise((resolve) => setTimeout(resolve, 150));

      const capture = async (excludeImages = false) => {
        return await toPng(cardElement, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          skipFonts: true,
          style: {
            borderRadius: '8px',
            boxShadow: 'none',
            border: '1px solid #dadde1',
          },
          filter: (domNode: any) => {
            if (excludeImages && (domNode.tagName === 'IMG' || domNode.tagName === 'Image')) {
              return false;
            }
            if (domNode.classList && (
              domNode.classList.contains('export-ignore') ||
              domNode.classList.contains('comments-section') ||
              domNode.tagName === 'BUTTON' ||
              domNode.tagName === 'FORM' ||
              domNode.tagName === 'TEXTAREA'
            )) {
              return false;
            }
            return true;
          }
        });
      };

      let dataUrl;
      try {
        dataUrl = await capture(false);
      } catch (err) {
        console.warn('Initial capture failed, trying without images...', err);
        dataUrl = await capture(true);
      }

      cardElement.classList.remove('exporting-mode');

      if (type === 'png') {
        const link = document.createElement('a');
        link.download = `post-${postId}.png`;
        link.href = dataUrl;
        link.click();
      } else if (type === 'pdf') {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [cardElement.clientWidth + 40, cardElement.clientHeight + 40]
        });
        pdf.addImage(dataUrl, 'PNG', 20, 20, cardElement.clientWidth, cardElement.clientHeight);
        pdf.save(`post-${postId}.pdf`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export post');
      cardElement.classList.remove('exporting-mode');
    } finally {
      setExportingPostId(null);
    }
  };

  const handleExportComposerPreview = async (type: 'png' | 'pdf') => {
    const cardElement = document.getElementById('composer-preview-card');
    if (!cardElement) return;

    setIsExportingComposer(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));

      const capture = async (excludeImages = false) => {
        return await toPng(cardElement, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          skipFonts: true,
          style: {
            borderRadius: '4px',
            boxShadow: 'none',
          },
          filter: (domNode: any) => {
            if (excludeImages && (domNode.tagName === 'IMG' || domNode.tagName === 'Image')) {
              return false;
            }
            return true;
          }
        });
      };

      let dataUrl;
      try {
        dataUrl = await capture(false);
      } catch (err) {
        console.warn('Composer preview initial capture failed, trying without images...', err);
        dataUrl = await capture(true);
      }

      if (type === 'png') {
        const link = document.createElement('a');
        link.download = `draft-post.png`;
        link.href = dataUrl;
        link.click();
      } else if (type === 'pdf') {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [cardElement.clientWidth + 40, cardElement.clientHeight + 40]
        });
        pdf.addImage(dataUrl, 'PNG', 20, 20, cardElement.clientWidth, cardElement.clientHeight);
        pdf.save(`draft-post.pdf`);
      }
    } catch (error) {
      console.error('Composer export failed:', error);
      alert('Failed to export preview');
    } finally {
      setIsExportingComposer(false);
    }
  };

  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);

  // Search and Tabs
  const [headerSearch, setHeaderSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"feed" | "myposts" | "leaderboard">("feed");
  const [isChangingTab, setIsChangingTab] = useState(false);

  useEffect(() => {
    setActiveSearch(searchVal);
  }, [searchVal]);

  // Leaderboard & Active Users
  const [topDevs, setTopDevs] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  // 1. Manage Supabase Session
  useEffect(() => {
    try {
      supabase.auth.getSession().then((res: any) => {
        const s = res.data?.session ?? null;
        setSession(s);
        if (s?.provider_token) {
          localStorage.setItem("gh_provider_token", s.provider_token);
        }
        setAuthLoading(false);
      }).catch((err: any) => {
        console.error("getSession error: ", err);
        setAuthLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setSession(session);
        if (session?.provider_token) {
          localStorage.setItem("gh_provider_token", session.provider_token);
        } else if (!session) {
          localStorage.removeItem("gh_provider_token");
        }
        setAuthLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (e: any) {
      console.error("useEffect 1 (Session) crash: ", e);
      setAuthLoading(false);
    }
  }, [supabase]);

  // 2. Fetch Logged-in Developer Profile
  useEffect(() => {
    try {
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
            console.error("fetch profile promise error: ", err);
          });
      } else {
        setCurrentDev(null);
      }
    } catch (e: any) {
      console.error("useEffect 2 (Profile) crash: ", e);
    }
  }, [session, supabase]);

  // 3. Fetch Posts Feed (with search & tab filters & page pagination & SWR cache)
  const fetchPosts = useCallback(async (searchVal = "", tabVal = activeTab, pageNum = 0, typeVal = feedType) => {
    const cacheKey = `git_social_feed_global_${tabVal}_${typeVal}_${searchVal}`;
    
    if (pageNum === 0) {
      setLoadingPosts(true);
      // Check client-side SWR cache
      try {
        const rawCache = sessionStorage.getItem(cacheKey);
        if (rawCache) {
          const cacheData = JSON.parse(rawCache);
          if (cacheData && Array.isArray(cacheData.posts)) {
            const isFresh = (Date.now() - cacheData.timestamp) < 30000; // 30s TTL
            setPosts(cacheData.posts);
            setHasMore(cacheData.posts.length > 0);
            setLoadingPosts(false);
            if (isFresh) {
              return; // Skip network request entirely
            }
          }
        }
      } catch (e) {
        console.warn("Error reading sessionStorage cache:", e);
      }
    } else {
      setLoadingMore(true);
    }
    
    let url = `/api/posts?limit=20&page=${pageNum}`;

    if (searchVal) {
      url += `&search=${encodeURIComponent(searchVal)}`;
    }

    if (tabVal === "feed" && typeVal === "for-you") {
      url += "&recommended=true";
    }

    if (tabVal === "myposts" && session?.user) {
      const login = (
        session.user.user_metadata?.user_name ??
        session.user.user_metadata?.preferred_username ??
        ""
      ).toLowerCase();
      url += `&username=${encodeURIComponent(login)}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.posts) {
        if (pageNum === 0) {
          setPosts(data.posts);
          setHasMore(data.posts.length > 0);
          // Write to SWR cache
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              timestamp: Date.now(),
              posts: data.posts
            }));
          } catch (e) {}
        } else {
          setPosts(prev => {
            const seen = new Set(prev.map(p => p.id));
            const uniqueNew = data.posts.filter((p: any) => !seen.has(p.id));
            return [...prev, ...uniqueNew];
          });
          setHasMore(data.posts.length > 0);
        }
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  }, [session, activeTab, feedType]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPosts(activeSearch, activeTab, nextPage, feedType);
  };

  // Fetch feed on mount or change of tab/search/feedType (resets to page 0)
  useEffect(() => {
    if (!authLoading) {
      setPage(0);
      setHasMore(true);
      fetchPosts(activeSearch, activeTab, 0, feedType);
    }
  }, [authLoading, activeTab, activeSearch, feedType, fetchPosts]);

  // 4. Fetch Right-Sidebar Stats & Top Developers
  useEffect(() => {
    // Fetch Top Developers by Contributions
    supabase
      .from("developers")
      .select("id, github_login, avatar_url, contributions, rank, public_repos")
      .order("contributions", { ascending: false })
      .limit(5)
      .then(({ data }: any) => {
        if (data) setTopDevs(data);
      });

    // Fetch Active Visitors
    supabase
      .from("site_visitors")
      .select("count", { count: "exact", head: true })
      .gte("last_seen", new Date(Date.now() - 5 * 60000).toISOString())
      .then(({ count }: any) => {
        setActiveCount(count ?? 1);
      });
  }, [supabase]);

  // 4b. Listen to rankings tab navigation custom event & mobile search focus
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("change-tab", handleTabChange);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("search") === "focus") {
      const input = document.querySelector('input[placeholder="Search posts..."]') as HTMLInputElement;
      if (input) {
        setTimeout(() => input.focus(), 150);
      }
    }

    return () => window.removeEventListener("change-tab", handleTabChange);
  }, []);

  // 5. Handlers
  const handleSignIn = async () => {
    alert("handleSignIn clicked! Origin: " + (typeof window !== 'undefined' ? window.location.origin : 'unknown'));
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "repo user:follow",
        },
      });
      if (error) {
        alert("Sign in failed: " + error.message);
      }
    } catch (err: any) {
      alert("Sign in error: " + (err?.message || err));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let providerToken = (session as any)?.provider_token;
      if (!providerToken) {
        providerToken = localStorage.getItem("gh_provider_token");
      }
      if (providerToken) {
        headers["x-github-token"] = providerToken;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: postContent }),
      });
      const data = await res.json();

      if (res.ok && data.post) {
        setPosts([data.post, ...posts]);
        setPostContent("");
        setEditorTab("write");
        // Clear client-side SWR caches on new post
        try {
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith("git_social_feed_")) {
              sessionStorage.removeItem(key);
            }
          }
        } catch (e) {}
      } else {
        alert(data.error || "Failed to create post");
      }
    } catch (err) {
      console.error(err);
      alert("Error posting content");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = (postId: number) => {
    if (!session) {
      handleSignIn();
      return;
    }

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    // Track original states for rollback and comparison
    if (originalLikes.current[postId] === undefined) {
      originalLikes.current[postId] = targetPost.liked_by_me;
      originalLikesCount.current[postId] = targetPost.likes_count;
      currentLikesRef.current[postId] = targetPost.liked_by_me;
    }

    const wasLiked = currentLikesRef.current[postId];
    const nextLiked = !wasLiked;
    
    // Calculate count based on original state
    const origLiked = originalLikes.current[postId];
    const origCount = originalLikesCount.current[postId];
    let nextLikesCount = origCount;
    if (origLiked) {
      nextLikesCount = nextLiked ? origCount : origCount - 1;
    } else {
      nextLikesCount = nextLiked ? origCount + 1 : origCount;
    }

    // Update current tracker
    currentLikesRef.current[postId] = nextLiked;

    // Optimistically update the UI instantly
    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            liked_by_me: nextLiked,
            likes_count: nextLikesCount,
          };
        }
        return p;
      })
    );

    // Debounce the actual backend request for 10 seconds
    if (likeTimeouts.current[postId]) {
      clearTimeout(likeTimeouts.current[postId]);
    }

    likeTimeouts.current[postId] = setTimeout(async () => {
      const finalLiked = currentLikesRef.current[postId];
      const startLiked = originalLikes.current[postId];
      const rollbackCount = originalLikesCount.current[postId];

      // Clean up local trackers for this post
      delete likeTimeouts.current[postId];
      delete originalLikes.current[postId];
      delete originalLikesCount.current[postId];
      delete currentLikesRef.current[postId];

      // If user toggled it back and forth, making the final state same as original, cancel API call!
      if (finalLiked === startLiked) {
        console.log(`[Like Debounce] Cancelled API call for post ${postId} (returned to original state: ${startLiked})`);
        return;
      }

      console.log(`[Like Debounce] Syncing Post ${postId} like change to GitHub (${startLiked} -> ${finalLiked})`);

      try {
        const headers: Record<string, string> = {};
        let providerToken = (session as any)?.provider_token;
        if (!providerToken && typeof window !== "undefined") {
          providerToken = localStorage.getItem("gh_provider_token") || undefined;
        }
        if (providerToken) {
          headers["x-github-token"] = providerToken;
        }

        const res = await fetch(`/api/posts/${postId}/like`, { 
          method: "POST",
          headers
        });
        const data = await res.json();

        if (!res.ok) {
          // Rollback on server error
          setPosts((prevPosts) =>
            prevPosts.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  liked_by_me: startLiked,
                  likes_count: rollbackCount,
                };
              }
              return p;
            })
          );
          alert(data.error || "Failed to like post");
        } else {
          // Sync with actual server response
          setPosts((prevPosts) =>
            prevPosts.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  liked_by_me: data.liked,
                  likes_count: rollbackCount + (data.liked ? (startLiked ? 0 : 1) : (startLiked ? -1 : 0)),
                };
              }
              return p;
            })
          );
        }
      } catch (err) {
        console.error(err);
        // Rollback on network failure
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                liked_by_me: startLiked,
                likes_count: rollbackCount,
              };
            }
            return p;
          })
        );
      }
    }, 10000);
  };

  const handleCommentSubmit = async (postId: number) => {
    const text = commentInputs[postId];
    if (!text || !text.trim() || commentingPostId === postId) return;

    setCommentingPostId(postId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let providerToken = (session as any)?.provider_token;
      if (!providerToken && typeof window !== "undefined") {
        providerToken = localStorage.getItem("gh_provider_token") || undefined;
      }
      if (providerToken) {
        headers["x-github-token"] = providerToken;
      }

      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();

      if (res.ok && data.comment) {
        setPosts(
          posts.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                comments_count: p.comments_count + 1,
                comments: [...p.comments, data.comment],
              };
            }
            return p;
          })
        );
        setCommentInputs({ ...commentInputs, [postId]: "" });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCommentingPostId(null);
    }
  };

  const handleTabChange = (newTab: "feed" | "myposts" | "leaderboard") => {
    if (newTab === activeTab && !activeSearch) return;
    setIsChangingTab(true);
    if (activeSearch) {
      router.push("/");
    }
    setActiveTab(newTab);
    setTimeout(() => {
      setIsChangingTab(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#1c1e21] font-sans antialiased relative">
      <div className="transition-all duration-300">


      {/* ─── Main Content Layout ─── */}
      <main className="mx-auto max-w-6xl px-3 py-4 grid grid-cols-12 gap-4">
        
        {/* 1. LEFT SIDEBAR (Current User Info & Nav) */}
        <section className="col-span-12 md:col-span-3 space-y-3">
          
          {/* User Profile Summary */}
          {session && currentDev ? (
            <div className="bg-white border border-[#dadde1] rounded-sm p-3 shadow-sm text-left">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 md:h-16 md:w-16 rounded-full overflow-hidden border-2 border-gray-200 shrink-0">
                  <Image
                    src={currentDev.avatar_url ?? "/default-avatar.png"}
                    alt={currentDev.github_login}
                    fill
                    sizes="(max-width: 768px) 48px, 64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-bold text-sm truncate">{currentDev.name || currentDev.github_login}</h3>
                  <p className="text-xs text-[#65676b] truncate">@{currentDev.github_login}</p>
                </div>
              </div>

              {/* Developer stats grid */}
              <div className="mt-3 pt-3 border-t border-[#dadde1] grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="block font-bold text-gray-800">{currentDev.contributions}</span>
                  <span className="text-[10px] text-[#65676b]">Contribs</span>
                </div>
                <div>
                  <span className="block font-bold text-gray-800">#{currentDev.rank || "?"}</span>
                  <span className="text-[10px] text-[#65676b]">Rank</span>
                </div>
                <div>
                  <span className="block font-bold text-gray-800">{currentDev.xp_level}</span>
                  <span className="text-[10px] text-[#65676b]">Level</span>
                </div>
              </div>

              {currentDev.assigned_repo && (
                <div className="mt-3 text-[10px] text-center bg-[#f0f2f5] py-1.5 px-2 rounded-sm border border-[#e4e6eb] truncate">
                  <Database className="h-3 w-3 inline mr-1 text-gray-600" />
                  <span className="font-mono text-gray-600">{currentDev.assigned_repo}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#dadde1] rounded-sm p-4 shadow-sm text-center">
              <h3 className="font-bold text-sm text-gray-700">Developer Network</h3>
              <p className="text-xs text-gray-500 mt-1">Sign in with GitHub to claim your repository and share your updates!</p>
              <a
                href="/api/auth/github"
                className="mt-3 w-full bg-[#3b5998] hover:bg-[#304d8a] text-white text-xs py-1.5 px-3 rounded-sm font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Github className="h-4 w-4" />
                Sign In
              </a>
            </div>
          )}

          {/* Quick Navigation Menu */}
          <div className="bg-white border border-[#dadde1] rounded-sm py-1.5 shadow-sm text-sm">
            <button
              onClick={() => handleTabChange("feed")}
              className={`w-full text-left px-4 py-2 hover:bg-[#f2f3f5] flex items-center gap-2.5 font-semibold ${
                activeTab === "feed" && !activeSearch ? "bg-[#e7f3ff] text-[#1877f2] border-l-4 border-[#1877f2] pl-3" : "text-[#1c1e21]"
              }`}
            >
              <Globe className="h-4 w-4" />
              News Feed
            </button>
            {session && (
              <button
                onClick={() => handleTabChange("myposts")}
                className={`w-full text-left px-4 py-2 hover:bg-[#f2f3f5] flex items-center gap-2.5 font-semibold ${
                  activeTab === "myposts" ? "bg-[#e7f3ff] text-[#1877f2] border-l-4 border-[#1877f2] pl-3" : "text-[#1c1e21]"
                }`}
              >
                <User className="h-4 w-4" />
                My Posts
              </button>
            )}
            <button
              onClick={() => handleTabChange("leaderboard")}
              className={`w-full text-left px-4 py-2 hover:bg-[#f2f3f5] flex items-center gap-2.5 font-semibold ${
                activeTab === "leaderboard" ? "bg-[#e7f3ff] text-[#1877f2] border-l-4 border-[#1877f2] pl-3" : "text-[#1c1e21]"
              }`}
            >
              <Award className="h-4 w-4" />
              Leaderboard
            </button>
          </div>
          <div className="mt-3">
            <GitHubSearchBox />
          </div>
        </section>

        {/* 2. CENTER CONTENT (Feed, Posts, Interactions) */}
        <section className="col-span-12 md:col-span-6 space-y-4">
          
          {/* Active Search Filter Badge */}
          {activeSearch && (
            <div className="bg-[#e7f3ff] border border-[#dadde1] rounded-sm p-3 flex items-center justify-between text-sm text-[#1877f2] shadow-sm font-semibold">
              <span>Showing search results for: "{activeSearch}"</span>
              <button
                onClick={() => router.push("/")}
                className="text-xs bg-[#dadde1] hover:bg-[#c9ccd1] text-gray-700 px-2 py-0.5 rounded-sm"
              >
                Show All
              </button>
            </div>
          )}

          {/* Feed recommendation type selector tab (For You / Latest) */}
          {activeTab === "feed" && !activeSearch && (
            <div className="bg-white border border-[#dadde1] rounded-sm shadow-sm flex overflow-hidden">
              <button
                onClick={() => setFeedType("for-you")}
                className="flex-1 py-3 text-center text-xs font-bold uppercase transition-all relative cursor-pointer focus:outline-none"
              >
                <span className={feedType === "for-you" ? "text-[#1877f2]" : "text-[#65676b] hover:text-[#1c1e21]"}>
                  For You
                </span>
                {feedType === "for-you" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[3px] bg-[#1877f2] rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setFeedType("latest")}
                className="flex-1 py-3 text-center text-xs font-bold uppercase transition-all relative border-l border-gray-100 cursor-pointer focus:outline-none"
              >
                <span className={feedType === "latest" ? "text-[#1877f2]" : "text-[#65676b] hover:text-[#1c1e21]"}>
                  Latest
                </span>
                {feedType === "latest" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-[3px] bg-[#1877f2] rounded-t-full" />
                )}
              </button>
            </div>
          )}

          {/* Post Composer Card */}
          {session && activeTab !== "leaderboard" && (
            <div className="bg-white border border-[#dadde1] rounded-sm shadow-sm overflow-hidden">
              {/* Header with Tabs */}
              <div className="bg-[#f5f6f7] px-3 border-b border-[#dadde1] flex justify-between items-center">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#4b4f56] uppercase py-2">
                  <Code className="h-3.5 w-3.5 text-[#3b5998]" />
                  Create Post
                </div>
                <div className="flex bg-white border-l border-r border-t border-[#dadde1] rounded-t-sm overflow-hidden self-end">
                  <button
                    type="button"
                    onClick={() => setEditorTab("write")}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase transition-all duration-150 ${
                      editorTab === "write"
                        ? "border-b-2 border-[#3b5998] text-[#3b5998] bg-white"
                        : "border-b-2 border-transparent text-[#65676b] hover:text-[#1c1e21] bg-[#f5f6f7]"
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab("preview")}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase transition-all duration-150 ${
                      editorTab === "preview"
                        ? "border-b-2 border-[#3b5998] text-[#3b5998] bg-white"
                        : "border-b-2 border-transparent text-[#65676b] hover:text-[#1c1e21] bg-[#f5f6f7]"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreatePost} className="p-3">
                {editorTab === "write" ? (
                  <div className="space-y-1.5">
                    {/* Markdown Formatting Toolbar */}
                    <div className="flex items-center gap-0.5 pb-2 border-b border-[#dadde1] flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleFormat("bold")}
                        title="Bold"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("italic")}
                        title="Italic"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("code")}
                        title="Inline Code"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <Code className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("codeblock")}
                        title="Code Block"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 font-mono text-[9px] font-bold px-1.5"
                      >
                        {"{ }"}
                      </button>
                      <span className="mx-1 h-4 w-px bg-gray-200" />
                      <button
                        type="button"
                        onClick={() => handleFormat("link")}
                        title="Link"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("quote")}
                        title="Quote"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <Quote className="h-4 w-4" />
                      </button>
                      <span className="mx-1 h-4 w-px bg-gray-200" />
                      <button
                        type="button"
                        onClick={() => handleFormat("bullet")}
                        title="Bullet List"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("ordered")}
                        title="Numbered List"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat("task")}
                        title="Task List"
                        className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0"
                      >
                        <CheckSquare className="h-4 w-4" />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      placeholder={`What's on your mind, ${currentDev?.name || "Developer"}? Write here, sync to GitHub... (Supports Markdown)`}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      onSelect={handleTextareaSelection}
                      rows={4}
                      className="w-full text-sm resize-none focus:outline-none border border-transparent focus:border-gray-200 p-1.5 rounded-sm"
                      maxLength={1000}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <div id="composer-preview-card" className="min-h-[108px] overflow-y-auto p-3 border border-dashed border-gray-300 rounded bg-gray-50 select-text relative">
                      {postContent.trim() ? (
                        <div className="space-y-3 bg-white p-4 border border-[#dadde1] rounded shadow-xs text-left">
                          <div className="flex items-center gap-2.5">
                            <div className="relative h-9 w-9 rounded-full overflow-hidden border border-gray-200 shrink-0">
                              <img
                                src={currentDev?.avatar_url ?? "/default-avatar.png"}
                                alt={currentDev?.github_login || "Developer"}
                                className="h-full w-full object-cover"
                                crossOrigin="anonymous"
                              />
                            </div>
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-xs text-[#3b5998]">
                                  {currentDev?.name || currentDev?.github_login || "Developer"}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  @{currentDev?.github_login || "dev"}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#65676b] block">
                                Preview Draft
                              </span>
                            </div>
                          </div>
                          <div className="text-sm leading-relaxed text-gray-800">
                            <MarkdownViewer content={postContent} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Nothing to preview</span>
                      )}
                    </div>
                    {postContent.trim() && (
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          disabled={isExportingComposer}
                          onClick={() => handleExportComposerPreview('png')}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[#4b4f56] font-bold rounded flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> Export PNG
                        </button>
                        <button
                          type="button"
                          disabled={isExportingComposer}
                          onClick={() => handleExportComposerPreview('pdf')}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-[#4b4f56] font-bold rounded flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> Export PDF
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-[#dadde1] flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 font-mono">
                    Post will save to database and sync to GitHub
                  </span>
                  <button
                    type="submit"
                    disabled={!postContent.trim() || isSubmitting}
                    className="bg-[#3b5998] hover:bg-[#304d8a] disabled:bg-[#8a9cc2] text-white text-xs font-bold px-4 py-1.5 rounded-sm active:transform active:scale-[0.98] shadow-sm flex items-center gap-1.5"
                  >
                    {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Post
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Main Feed Content Panel */}
          {activeTab === "leaderboard" ? (
            /* Tab: Leaderboard List */
            <div className="bg-white border border-[#dadde1] rounded-sm shadow-sm">
              <div className="bg-[#f5f6f7] px-4 py-3 border-b border-[#dadde1] font-bold text-sm text-[#4b4f56]">
                🎖️ Developer Leaderboard
              </div>
              <div className="divide-y divide-[#dadde1]">
                {topDevs.map((dev, idx) => (
                  <div key={dev.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-gray-400 w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="relative h-10 w-10 rounded-full overflow-hidden border border-gray-200">
                        <Image
                          src={dev.avatar_url ?? "/default-avatar.png"}
                          alt={dev.github_login}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <Link 
                          href={`/dev/${dev.github_login}`} 
                          className="font-bold hover:underline text-[#3b5998] text-sm"
                        >
                          @{dev.github_login}
                        </Link>
                        <span className="text-[10px] text-gray-500 ml-2">
                          {dev.public_repos} repos
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm block">
                        {dev.contributions.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-500">contributions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Tab: Posts Feed */
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="flex items-center justify-center p-12 bg-white border border-[#dadde1] rounded-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3b5998]" />
                  <span className="ml-2 text-sm text-gray-500 font-semibold">Loading feed posts...</span>
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white border border-[#dadde1] rounded-sm p-8 text-center text-gray-500">
                  <Globe className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-sm">No posts found</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to share an update on the network!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} id={`post-card-${post.id}`} className="bg-white border border-[#dadde1] rounded-sm shadow-sm relative">
                    
                    {/* Post Author Header */}
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/dev/${post.developer?.github_login}`}
                          className="relative h-9 w-9 rounded-full overflow-hidden border border-gray-200 block shrink-0"
                        >
                          <Image
                            src={post.developer?.avatar_url ?? "/default-avatar.png"}
                            alt={post.developer?.github_login}
                            fill
                            sizes="36px"
                            className="object-cover"
                            crossOrigin="anonymous"
                          />
                        </Link>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/dev/${post.developer?.github_login}`}
                              className="font-bold text-xs hover:underline text-[#3b5998]"
                            >
                              {post.developer?.name || post.developer?.github_login}
                            </Link>
                            <span className="text-[10px] text-gray-400 font-mono">
                              @{post.developer?.github_login}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#65676b] block">
                            {formatRelativeTime(post.created_at)}
                          </span>
                        </div>
                      </div>

                      {post.github_issue_number && (
                        <Link
                          href={post.developer?.assigned_repo_url ? `${post.developer.assigned_repo_url}/issues/${post.github_issue_number}` : `https://github.com/cl-andro/social-${post.developer?.github_login}/issues/${post.github_issue_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-600 font-mono text-[9px] px-2 py-0.5 rounded border border-[#ccd0d5] flex items-center gap-1"
                        >
                          <Github className="h-3 w-3" />
                          Issue #{post.github_issue_number}
                        </Link>
                      )}
                    </div>

                    {/* Post Content */}
                    <div className="px-3 pb-3 text-sm leading-relaxed select-text">
                      <MarkdownViewer content={post.content} />
                    </div>

                    {/* Post Likes / Comments Counts */}
                    <div className="px-3 py-1.5 border-t border-b border-[#dadde1] bg-[#f5f6f7] flex items-center justify-between text-[11px] text-[#65676b]">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-[#1877f2]" />
                        <span>{post.likes_count} Likes</span>
                      </div>
                      <div className="hover:underline cursor-pointer">
                        {post.comments_count} Comments
                      </div>
                    </div>

                    {/* Like, Comment & Download Buttons */}
                    <div className="px-1 py-1 grid grid-cols-3 gap-1 text-[#65676b] font-bold text-xs text-center border-t border-[#dadde1] export-ignore">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          post.liked_by_me ? "text-[#1877f2]" : ""
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Like
                      </button>
                      <button
                        onClick={() => {
                          const input = document.getElementById(`comment-input-${post.id}`);
                          if (input) input.focus();
                        }}
                        className="py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comment
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveExportDropdown(activeExportDropdown === post.id ? null : post.id);
                          }}
                          disabled={exportingPostId === post.id}
                          className="w-full py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {exportingPostId === post.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b5998]" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Download
                        </button>
                        {activeExportDropdown === post.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-30" 
                              onClick={() => setActiveExportDropdown(null)} 
                            />
                            <div className="absolute right-0 bottom-full mb-1 bg-white border border-[#dadde1] rounded shadow-lg py-1 z-40 w-32 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                              <button
                                onClick={() => {
                                  setActiveExportDropdown(null);
                                  handleExportPost(post.id, 'png');
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-[#f2f3f5] flex items-center gap-2 font-semibold cursor-pointer"
                              >
                                <span>PNG Image</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveExportDropdown(null);
                                  handleExportPost(post.id, 'pdf');
                                }}
                                className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-[#f2f3f5] flex items-center gap-2 font-semibold cursor-pointer"
                              >
                                <span>PDF Document</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Comments Section */}
                    {post.comments && post.comments.length > 0 && (
                      <div className="bg-[#f5f6f7] border-t border-[#dadde1] px-3 py-2 space-y-2.5 comments-section export-ignore">
                        {post.comments.map((comment: any) => (
                          <div key={comment.id} className="flex items-start gap-2 text-xs">
                            <Link
                              href={`/dev/${comment.developer?.github_login}`}
                              className="relative h-6 w-6 rounded-full overflow-hidden border border-gray-200 shrink-0 mt-0.5 block"
                            >
                              <Image
                                src={comment.developer?.avatar_url ?? "/default-avatar.png"}
                                alt={comment.developer?.github_login}
                                fill
                                sizes="24px"
                                className="object-cover"
                              />
                            </Link>
                            <div className="bg-white border border-[#dadde1] rounded-lg px-2.5 py-1.5 max-w-[90%]">
                              <div className="flex items-baseline gap-1.5">
                                <Link
                                  href={`/dev/${comment.developer?.github_login}`}
                                  className="font-bold text-[11px] text-[#3b5998] hover:underline"
                                >
                                  {comment.developer?.name || comment.developer?.github_login}
                                </Link>
                                <span className="text-[9px] text-gray-400 font-mono">
                                  @{comment.developer?.github_login}
                                </span>
                              </div>
                              <div className="mt-0.5 text-gray-800 leading-snug select-text">
                                <MarkdownViewer content={comment.content} />
                              </div>
                              <span className="text-[9px] text-[#65676b] block mt-1">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Write Comment Box */}
                    {session ? (
                      <div className="p-2 border-t border-[#dadde1] bg-[#f5f6f7] flex items-center gap-2 export-ignore">
                        <input
                          id={`comment-input-${post.id}`}
                          type="text"
                          placeholder="Write a comment..."
                          value={commentInputs[post.id] ?? ""}
                          onChange={(e) =>
                            setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCommentSubmit(post.id);
                            }
                          }}
                          className="flex-1 bg-white text-xs px-3 py-1.5 border border-[#dadde1] rounded-full focus:outline-none"
                        />
                        <button
                          onClick={() => handleCommentSubmit(post.id)}
                          disabled={!(commentInputs[post.id] ?? "").trim() || commentingPostId === post.id}
                          className="bg-transparent hover:bg-[#e4e6eb] disabled:opacity-30 text-[#3b5998] p-1.5 rounded-full flex items-center justify-center shrink-0"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 border-t border-[#dadde1] bg-[#f5f6f7] text-[11px] text-[#65676b] text-center export-ignore">
                        Please <button onClick={handleSignIn} className="text-[#1877f2] font-bold hover:underline">Sign In</button> to comment locally, or{" "}
                        {post.github_issue_number ? (
                          <Link
                            href={post.developer?.assigned_repo_url ? `${post.developer.assigned_repo_url}/issues/${post.github_issue_number}` : `https://github.com/cl-andro/social-${post.developer?.github_login}/issues/${post.github_issue_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1877f2] font-bold hover:underline inline-flex items-center gap-0.5"
                          >
                            Comment on GitHub
                          </Link>
                        ) : (
                          <span>Comment on GitHub</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* Load More Button */}
              {posts.length > 0 && hasMore && (
                <div className="pt-2 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full bg-[#f5f6f7] hover:bg-[#e4e6eb] active:bg-[#d8dadf] border border-[#ccd0d5] text-gray-700 font-bold text-xs py-2 rounded-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. RIGHT SIDEBAR (Network Leaderboard & Stats) */}
        <section className="col-span-12 md:col-span-3 space-y-4">
          
          {/* Active Network Status */}
          <div className="bg-white border border-[#dadde1] rounded-sm p-3.5 shadow-sm text-xs space-y-2">
            <h4 className="font-bold text-[#4b4f56] uppercase tracking-wide text-[10px]">
              Network Status
            </h4>
            <div className="flex items-center justify-between text-gray-700">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-gray-500" />
                Active Developers
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 bg-[#42b72a] rounded-full animate-pulse inline-block"></span>
                <span className="font-bold">{activeCount} online</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-700">
              <span className="flex items-center gap-1.5 font-sans">
                <Award className="h-3.5 w-3.5 text-gray-500" />
                Rankings Type
              </span>
              <span className="font-bold text-gray-600">Global</span>
            </div>
          </div>

          {/* Top Contributor Showcase (fb 2015 widget style) */}
          <div className="bg-white border border-[#dadde1] rounded-sm p-3 shadow-sm">
            <h4 className="font-bold text-[#4b4f56] uppercase tracking-wide text-[10px] pb-2 border-b border-[# dadde1] mb-2.5">
              Top Contributors
            </h4>
            <div className="space-y-3">
              {topDevs.map((dev, idx) => (
                <div key={dev.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-400 w-3">{idx + 1}</span>
                    <div className="relative h-6 w-6 rounded-full overflow-hidden border border-gray-100">
                      <Image
                        src={dev.avatar_url ?? "/default-avatar.png"}
                        alt={dev.github_login}
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    </div>
                    <Link
                      href={`/dev/${dev.github_login}`}
                      className="font-semibold hover:underline text-[#3b5998] truncate max-w-[80px]"
                    >
                      @{dev.github_login}
                    </Link>
                  </div>
                  <span className="font-mono text-gray-500 text-[10px]">
                    {dev.contributions} pts
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleTabChange("leaderboard")}
              className="mt-3.5 w-full text-center block bg-[#f5f6f7] hover:bg-[#ebedf0] text-[#3b5998] border border-[#dadde1] py-1 text-[10px] font-bold rounded-sm shadow-sm"
            >
              See All Rankings
            </button>
          </div>
        </section>

      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-[#dadde1] py-6 mt-12 mb-16 md:mb-0 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p>© 2026 Cluster Org • All Rights Reserved</p>
        </div>
      </footer>

      {/* Twitter-like Bottom Navigation for mobile */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          handleTabChange(tab);
        }}
        onSearchFocus={() => {
          const input = document.querySelector('input[placeholder="Search posts..."]') as HTMLInputElement;
          if (input) {
            input.focus();
            input.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
      />
      </div>

      {/* Custom Link Modal Overlay */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[999] p-4">
          <div className="bg-white border border-[#dadde1] w-full max-w-sm rounded-lg shadow-2xl p-4 animate-in zoom-in-95 duration-150 text-left">
            <h3 className="font-bold text-sm text-gray-800 mb-3">Insert Link</h3>
            <form onSubmit={handleInsertLink} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">URL</label>
                <input
                  type="text"
                  placeholder="https://"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#dadde1] rounded focus:outline-none focus:border-[#1877f2]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Link Text</label>
                <input
                  type="text"
                  placeholder="Link text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#dadde1] rounded focus:outline-none focus:border-[#1877f2]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLinkModalOpen(false);
                    setTextareaSelRange(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#1877f2] hover:bg-[#166fe5] rounded transition-colors"
                >
                  Insert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PostModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onPostCreated={(newPost) => {
          setPosts([newPost, ...posts]);
          // Clear client-side SWR caches on new post
          try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith("git_social_feed_")) {
                sessionStorage.removeItem(key);
              }
            }
          } catch (e) {}
        }}
        session={session}
        currentDev={currentDev}
      />
    </div>
  );
}
