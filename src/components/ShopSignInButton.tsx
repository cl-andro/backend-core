"use client";

import { createBrowserSupabase, triggerGitHubLogin } from "@/lib/supabase";

export default function ShopSignInButton() {
  const handleSignIn = async () => {
    const supabase = createBrowserSupabase();
    await triggerGitHubLogin(supabase, "/shop");
  };

  return (
    <button
      onClick={handleSignIn}
      className="btn-press flex items-center gap-2 px-8 py-3.5 text-sm text-bg cursor-pointer"
      style={{
        backgroundColor: "#c8e64a",
        boxShadow: "4px 4px 0 0 #5a7a00",
      }}
    >
      Sign in with GitHub
    </button>
  );
}
