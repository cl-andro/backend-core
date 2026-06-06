"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { 
  ThumbsUp, 
  MessageSquare, 
  Send, 
  Github, 
  ExternalLink,
  MessageCircle,
  PlusCircle,
  AlertCircle,
  Loader2,
  Download,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code
} from "lucide-react";
import { toPng } from "html-to-image";
import Image from "next/image";
import Link from "next/link";
import { createBrowserSupabase, triggerGitHubLogin } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import MarkdownViewer from "@/components/MarkdownViewer";
import PostModal from "@/components/PostModal";


interface ProfileClientProps {
  username: string;
  devId: number;
  assignedRepo: string | null;
  assignedRepoUrl: string | null;
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
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
  return `${diffDays}d ago`;
}

export default function ProfileClient({
  username,
  devId,
  assignedRepo,
  assignedRepoUrl,
  displayName,
  avatarUrl,
  isOwner: serverIsOwner,
}: ProfileClientProps) {
  const supabase = createBrowserSupabase();
  const [session, setSession] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);

  // Refs for debouncing like actions (optimistic update queues)
  const likeTimeouts = useRef<Record<number, NodeJS.Timeout>>({});
  const originalLikes = useRef<Record<number, boolean>>({});
  const currentLikesRef = useRef<Record<number, boolean>>({});
  const originalLikesCount = useRef<Record<number, number>>({});

  // Post modal overlay state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [currentDev, setCurrentDev] = useState<any>(null);

  // Export/Download states
  const [exportingPostId, setExportingPostId] = useState<number | null>(null);

  // Rich Composer States
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [textareaSelRange, setTextareaSelRange] = useState<{ start: number; end: number } | null>(null);
  const [isExportingComposer, setIsExportingComposer] = useState(false);

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
      for (const placeholder of PLACEHOLDERS) {
        let index = -1;
        while ((index = val.indexOf(placeholder, index + 1)) !== -1) {
          if (start >= index && start <= index + placeholder.length) {
            textarea.setSelectionRange(index, index + placeholder.length);
            return;
          }
        }
      }

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

  const handleExportComposerPreview = async () => {
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
          pixelRatio: 2,
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

      const link = document.createElement('a');
      link.download = `draft-post.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Composer export failed:', error);
      alert('Failed to export preview');
    } finally {
      setIsExportingComposer(false);
    }
  };

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
          if (data) setCurrentDev(data);
        });
    }
  }, [session, supabase]);

  useEffect(() => {
    const handleOpenModal = () => setIsPostModalOpen(true);
    window.addEventListener("open-post-modal", handleOpenModal);
    return () => window.removeEventListener("open-post-modal", handleOpenModal);
  }, []);



  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Get active session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      const s = data?.session;
      setSession(s);
      if (s?.provider_token) {
        localStorage.setItem("gh_provider_token", s.provider_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, currentSession: any) => {
      setSession(currentSession);
      if (currentSession?.provider_token) {
        localStorage.setItem("gh_provider_token", currentSession.provider_token);
      } else if (!currentSession) {
        localStorage.removeItem("gh_provider_token");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fetch posts for this developer (with SWR client-side caching)
  const fetchPosts = useCallback(async (pageNum = 0) => {
    const cacheKey = `git_social_feed_user_${username.toLowerCase()}`;
    
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

    try {
      const res = await fetch(`/api/posts?limit=20&page=${pageNum}&username=${encodeURIComponent(username)}`);
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
  }, [username]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPosts(nextPage);
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0);
  }, [fetchPosts]);

  const handleSignIn = async () => {
    await triggerGitHubLogin(supabase, window.location.pathname);
  };

  const handleExportPost = async (postId: number) => {
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
          pixelRatio: 2,
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

      const link = document.createElement('a');
      link.download = `post-${postId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export post');
      cardElement.classList.remove('exporting-mode');
    } finally {
      setExportingPostId(null);
    }
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

  // Determine if the client session user matches the profile owner
  const loggedInLogin = (
    session?.user?.user_metadata?.user_name ??
    session?.user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();
  const isActualOwner = serverIsOwner || (!!session?.user && loggedInLogin === username.toLowerCase());

  return (
    <div className="relative">
      <div className="space-y-4 transition-all duration-300">
      {/* 1. COMPOSER CARD (Owner only) */}
      {isActualOwner && (
        <div className="bg-white border border-[#dadde1] rounded-lg shadow-sm overflow-hidden">
          {/* Header with Tabs */}
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 uppercase">
              <Code className="h-3.5 w-3.5 text-[#1877f2]" />
              Create Post
            </div>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setEditorTab("write")}
                className={`px-3 py-1 text-[11px] font-bold uppercase transition-all duration-150 rounded-md cursor-pointer ${
                  editorTab === "write"
                    ? "text-[#1877f2] bg-white shadow-xs"
                    : "text-[#65676b] hover:text-[#1c1e21]"
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("preview")}
                className={`px-3 py-1 text-[11px] font-bold uppercase transition-all duration-150 rounded-md cursor-pointer ${
                  editorTab === "preview"
                    ? "text-[#1877f2] bg-white shadow-xs"
                    : "text-[#65676b] hover:text-[#1c1e21]"
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
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("italic")}
                    title="Italic"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("code")}
                    title="Inline Code"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Code className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("codeblock")}
                    title="Code Block"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 font-mono text-[9px] font-bold px-1.5 cursor-pointer"
                  >
                    {"{ }"}
                  </button>
                  <span className="mx-1 h-4 w-px bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => handleFormat("link")}
                    title="Link"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("quote")}
                    title="Quote"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Quote className="h-4 w-4" />
                  </button>
                  <span className="mx-1 h-4 w-px bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => handleFormat("bullet")}
                    title="Bullet List"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("ordered")}
                    title="Numbered List"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormat("task")}
                    title="Task List"
                    className="p-1 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder={`What's on your mind, ${displayName}? Write here, sync to GitHub... (Supports Markdown)`}
                  onSelect={handleTextareaSelection}
                  rows={4}
                  className="w-full text-sm resize-none focus:outline-none border border-transparent focus:border-slate-100 p-2.5 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-0 bg-white"
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
                            src={avatarUrl ?? "/default-avatar.png"}
                            alt={username}
                            className="h-full w-full object-cover"
                            crossOrigin="anonymous"
                          />
                        </div>
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-xs text-[#3b5998]">
                              {displayName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              @{username}
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
                  <div className="flex justify-end gap-2 text-[10px] px-1.5">
                    <button
                      type="button"
                      disabled={isExportingComposer}
                      onClick={() => handleExportComposerPreview()}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-[#4b4f56] font-bold rounded flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="h-3 w-3" /> Export PNG
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-[#e5e5e5] mt-3 pt-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-mono">
                  Syncs to {assignedRepo ?? `social-${username}`}
                </span>
                <span className="text-[9px] text-gray-400 font-mono">
                  {postContent.length}/1000 characters
                </span>
              </div>
              <button
                type="submit"
                disabled={!postContent.trim() || isSubmitting}
                className="bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold text-xs px-4 py-1.5 rounded-md shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting ? "Posting..." : "Share"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. TIMELINE FEED */}
      <div className="space-y-4">
        {loadingPosts ? (
          <div className="bg-white border border-[#dadde1] rounded-lg shadow-sm p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#1877f2]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-[#dadde1] rounded-lg shadow-sm p-8 text-center text-gray-500">
            <p className="font-bold text-sm">No posts yet</p>
            <p className="text-xs text-gray-400 mt-1">Updates posted by @{username} will show up on this timeline.</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} id={`post-card-${post.id}`} className="bg-white border border-[#dadde1] rounded-lg shadow-sm relative">
              
              {/* Post Author Header */}
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 rounded-full overflow-hidden border border-gray-200 shrink-0">
                    <Image
                      src={post.developer?.avatar_url ?? "/default-avatar.png"}
                      alt={post.developer?.github_login}
                      fill
                      sizes="36px"
                      className="object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-xs text-[#3b5998]">
                        {post.developer?.name || post.developer?.github_login}
                      </span>
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
                    className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-600 font-mono text-[9px] px-2 py-0.5 rounded border border-[#ccd0d5] flex items-center gap-1 transition-colors"
                  >
                    <Github className="h-3 w-3" />
                    Issue #{post.github_issue_number}
                  </Link>
                )}
              </div>

              {/* Post Content */}
              <div className="px-3.5 pb-3.5 text-sm leading-relaxed select-text text-gray-800">
                <MarkdownViewer content={post.content} />
              </div>

              {/* Likes / Comments Count */}
              <div className="px-3.5 py-2 border-t border-b border-[#dadde1] bg-[#f5f6f7] flex items-center justify-between text-[11px] text-[#65676b]">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-[#1877f2]" />
                  <span>{post.likes_count} Likes</span>
                </div>
                <div className="hover:underline cursor-pointer">
                  {post.comments_count} Comments
                </div>
              </div>

              {/* Like, Comment & Download Buttons */}
              <div className="px-1 py-1 grid grid-cols-3 gap-1 text-[#65676b] font-bold text-xs text-center border-b border-[#dadde1] export-ignore">
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportPost(post.id);
                    }}
                    disabled={exportingPostId === post.id}
                    className="py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {exportingPostId === post.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b5998]" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download PNG
                  </button>
              </div>

              {/* Comments list */}
              {post.comments && post.comments.length > 0 && (
                <div className="bg-[#f5f6f7] px-3.5 py-2.5 space-y-3 comments-section export-ignore">
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

      {/* Sticky Bottom Nav for mobile */}
      <BottomNav activeTab="profile" />
      </div>

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

      {/* Custom Link Modal Overlay */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[999] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#dadde1] w-full max-w-sm rounded-lg shadow-2xl p-4 animate-in zoom-in-95 duration-150 text-left">
            <h3 className="font-bold text-sm text-gray-800 mb-3 font-sans">Insert Link</h3>
            <form onSubmit={handleInsertLink} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 font-sans">URL</label>
                <input
                  type="text"
                  placeholder="https://"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#dadde1] rounded focus:outline-none focus:border-[#1877f2] text-slate-800 bg-white font-sans animate-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 font-sans">Link Text</label>
                <input
                  type="text"
                  placeholder="Link text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#dadde1] rounded focus:outline-none focus:border-[#1877f2] text-slate-800 bg-white font-sans"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLinkModalOpen(false);
                    setTextareaSelRange(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded transition-colors cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#1877f2] hover:bg-[#166fe5] rounded transition-colors cursor-pointer font-sans"
                >
                  Insert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
