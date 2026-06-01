"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";

export default function GitHubSearchBox() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim().toLowerCase();
    if (trimmed) {
      setLoading(true);
      try {
        const supabase = createBrowserSupabase();
        const { data } = await supabase
          .from("developers")
          .select("github_login")
          .eq("github_login", trimmed)
          .maybeSingle();

        if (data) {
          router.push(`/dev/${trimmed}`);
        } else {
          router.push(`/github/${trimmed}`);
        }
      } catch (err) {
        console.error("Search error:", err);
        router.push(`/github/${trimmed}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4">
      <h3 className="font-bold text-sm text-[#1c1e21] mb-1">Search Profile</h3>
      <p className="text-xs text-gray-500 mb-3">Lookup any developer account to view their public repositories, star ratings, and raise issues.</p>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          className="flex-1 bg-white border border-[#bcc0c4] rounded-md text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1877f2] focus:border-[#1877f2] text-black disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          <span>{loading ? "Searching" : "Go"}</span>
        </button>
      </form>
    </div>
  );
}
