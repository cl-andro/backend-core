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
  Loader2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
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

  const handleSignIn = () => {
    window.location.href = `/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}`;
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
        <div className="bg-white border border-[#dadde1] rounded-lg shadow-sm p-4">
          <div className="flex gap-2.5 items-start">
            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-gray-200 shrink-0">
              <Image
                src={avatarUrl ?? "/default-avatar.png"}
                alt={username}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <form onSubmit={handleCreatePost} className="flex-1 space-y-3">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={`What's on your mind, ${displayName}?`}
                rows={3}
                className="w-full border-none outline-none resize-none text-sm text-gray-800 placeholder-gray-500 focus:ring-0"
              />
              <div className="border-t border-[#e5e5e5] pt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono">Syncs to {assignedRepo ?? `social-${username}`}</span>
                <button
                  type="submit"
                  disabled={!postContent.trim() || isSubmitting}
                  className="bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 text-white font-bold text-xs px-4 py-1.5 rounded-md shadow-sm transition-colors"
                >
                  {isSubmitting ? "Posting..." : "Share"}
                </button>
              </div>
            </form>
          </div>
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
            <div key={post.id} className="bg-white border border-[#dadde1] rounded-lg shadow-sm">
              
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

              {/* Like / Comment Buttons */}
              <div className="px-1 py-1 grid grid-cols-2 gap-1 text-[#65676b] font-bold text-xs text-center border-b border-[#dadde1]">
                <button
                  onClick={() => handleLikePost(post.id)}
                  className={`py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors ${
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
                  className="py-1.5 hover:bg-[#f2f3f5] rounded flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comment
                </button>
              </div>

              {/* Comments list */}
              {post.comments && post.comments.length > 0 && (
                <div className="bg-[#f5f6f7] px-3.5 py-2.5 space-y-3">
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
                <div className="p-2 border-t border-[#dadde1] bg-[#f5f6f7] flex items-center gap-2">
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
                <div className="p-2 border-t border-[#dadde1] bg-[#f5f6f7] text-[11px] text-[#65676b] text-center">
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
    </div>
  );
}
