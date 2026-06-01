"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createIssue } from "@/lib/github-actions";
import { createBrowserSupabase } from "@/lib/supabase";
import { 
  AlertCircle, 
  Send, 
  ChevronLeft,
  Info
} from "lucide-react";

interface NewIssueClientProps {
  username: string;
  repoName: string;
}

export default function NewIssueClient({ username, repoName }: NewIssueClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createIssue(username, repoName, title, body, userToken);
      if (res.success && res.issue) {
        // Redirect to the newly created issue page
        router.push(`/github/${username}/${repoName}/issues/${res.issue.number}`);
      } else {
        setError(res.error || "Failed to create issue. Make sure your GitHub token has permissions to write to this repository.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] pb-16 md:pb-6">
      
      {/* Navigation link */}
      <div className="max-w-2xl mx-auto px-3 md:px-4 pt-4 mb-4">
        <Link 
          href={`/github/${username}/${repoName}?tab=issues`} 
          className="inline-flex items-center gap-1 text-[#1877f2] hover:underline text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Cancel and return to repository
        </Link>
      </div>

      {/* Main card */}
      <div className="max-w-2xl mx-auto px-3 md:px-4">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-5 md:p-6 space-y-5">
          
          <div className="border-b border-gray-100 pb-3">
            <h1 className="text-xl font-bold text-[#1c1e21]">Create a New Issue</h1>
            <p className="text-xs text-gray-500 mt-1">
              Submit a new issue to <strong className="text-gray-700">{username}/{repoName}</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Title field */}
            <div className="space-y-1">
              <label htmlFor="issue-title" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="issue-title"
                type="text"
                placeholder="Title your issue..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full bg-[#f0f2f5] border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] text-black disabled:opacity-50 font-semibold"
              />
            </div>

            {/* Body field */}
            <div className="space-y-1">
              <label htmlFor="issue-body" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Description
              </label>
              <textarea
                id="issue-body"
                placeholder="Describe the issue in detail (supports markdown)..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSubmitting}
                rows={8}
                className="w-full bg-[#f0f2f5] border border-gray-300 rounded-md text-sm p-3 focus:outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] text-black disabled:opacity-50"
              />
            </div>

            {/* Token Permissions Warning Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-normal">
                Note: Creating issues uses the server-configured GitHub integration token. If the repository is owned by another user and does not accept public issues/contributions, creation may fail.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-medium p-3 rounded border border-red-200 flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <Link
                href={`/github/${username}/${repoName}?tab=issues`}
                className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold py-2 px-4 rounded-md border border-gray-300 shadow-sm transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold py-2 px-4 rounded-md shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Submitting..." : "Submit Issue"}</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
