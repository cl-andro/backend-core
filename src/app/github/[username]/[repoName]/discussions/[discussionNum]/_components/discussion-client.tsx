"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDiscussionComment } from "@/lib/github-actions";
import MarkdownViewer from "@/components/MarkdownViewer";
import { createBrowserSupabase } from "@/lib/supabase";
import { 
  AlertCircle, 
  MessageSquare, 
  Send, 
  ExternalLink,
  ChevronLeft,
  ShieldAlert
} from "lucide-react";

interface DiscussionClientProps {
  username: string;
  repoName: string;
  discussionData: { success: boolean; discussion?: any; error?: string };
  discussionNum: number;
  repoHtmlUrl: string;
}

export default function DiscussionClient({
  username,
  repoName,
  discussionData,
  discussionNum,
  repoHtmlUrl,
}: DiscussionClientProps) {
  const router = useRouter();
  const [commentBody, setCommentBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserSupabase();
  const [userToken, setUserToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      if (data?.session?.provider_token) {
        setUserToken(data.session.provider_token);
        localStorage.setItem("gh_provider_token", data.session.provider_token);
      } else {
        const localToken = localStorage.getItem("gh_provider_token");
        if (localToken) {
          setUserToken(localToken);
        }
      }
    });
  }, [supabase]);

  if (!discussionData.success || !discussionData.discussion) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-700 mb-2">Error Loading Discussion</h2>
            <p className="text-sm text-gray-500 mb-6">
              {discussionData.error || "We encountered an issue fetching this discussion from GitHub's GraphQL API. GitHub Discussions require authentication and may have API limits."}
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href={`/github/${username}/${repoName}?tab=discussions`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold px-4 py-2 rounded-md transition-colors"
              >
                Go Back to Discussions
              </Link>
              <a
                href={`${repoHtmlUrl}/discussions/${discussionNum}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#24292e] hover:bg-black text-white text-sm font-bold px-4 py-2 rounded-md transition-colors flex items-center gap-1.5"
              >
                <span>View on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const discussion = discussionData.discussion;
  const comments = discussion.comments?.nodes || [];

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createDiscussionComment(discussion.id, commentBody, userToken);
      if (res.success) {
        setCommentBody("");
        router.refresh(); // Refresh page to show the new comment
      } else {
        setError(res.error || "Failed to post comment. Make sure your GitHub token has write permissions.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] pb-16 md:pb-6">
      
      {/* Top navigation */}
      <div className="max-w-3xl mx-auto px-3 md:px-4 pt-4 mb-4">
        <Link 
          href={`/github/${username}/${repoName}?tab=discussions`} 
          className="inline-flex items-center gap-1 text-[#1877f2] hover:underline text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to discussions list
        </Link>
      </div>

      {/* Main Container */}
      <div className="max-w-3xl mx-auto px-3 md:px-4 space-y-6">
        
        {/* 1. DISCUSSION CARD */}
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-5 md:p-6 space-y-4">
          <div className="border-b border-gray-100 pb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-[#1c1e21]">
                {discussion.title}
              </h1>
              <span className="text-gray-400 font-mono text-lg">#{discussion.number}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                {discussion.author?.avatarUrl && (
                  <img
                    src={discussion.author.avatarUrl}
                    alt={discussion.author.login}
                    className="h-5 w-5 rounded-full border border-gray-200"
                  />
                )}
                <span className="font-semibold text-gray-700">@{discussion.author?.login}</span>
                <span>started this discussion on {new Date(discussion.createdAt).toLocaleDateString()}</span>
              </div>
              
              {discussion.upvoteCount > 0 && (
                <span className="text-xs bg-gray-50 px-2 py-0.5 rounded border border-gray-200 font-semibold text-gray-600">
                  ▲ {discussion.upvoteCount} upvotes
                </span>
              )}
            </div>
          </div>

          {/* Discussion body description */}
          <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed min-h-[50px]">
            {discussion.body ? (
              <MarkdownViewer content={discussion.body} />
            ) : (
              <p className="text-gray-400 italic">No description provided.</p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 flex justify-end">
            <a
              href={`${repoHtmlUrl}/discussions/${discussion.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-gray-500 hover:text-[#1877f2] flex items-center gap-1"
            >
              <span>Open in GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* 2. COMMENTS SECTION */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 px-1">
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </h3>

          {comments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-8 text-center text-gray-500">
              <p className="font-semibold text-sm">No comments yet</p>
              <p className="text-xs text-gray-400 mt-1">Be the first to reply below.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 flex gap-3 transition-shadow hover:shadow-sm">
                  {comment.author?.avatarUrl && (
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.login}
                      className="h-8 w-8 rounded-full border border-gray-200 shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1c1e21]">@{comment.author?.login}</span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed">
                      <MarkdownViewer content={comment.body} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. LEAVE A COMMENT FORM */}
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 md:p-5">
          <h4 className="text-sm font-bold text-[#1c1e21] mb-3">Add to Discussion</h4>
          
          <form onSubmit={handleCommentSubmit} className="space-y-3">
            <textarea
              placeholder="Write your response here (supports markdown)..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              className="w-full bg-[#f0f2f5] border border-gray-300 rounded-md text-sm p-3 focus:outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] text-black disabled:opacity-50"
            />

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-medium p-2.5 rounded border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !commentBody.trim()}
                className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold py-2 px-4 rounded-md shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Posting..." : "Post Response"}</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
