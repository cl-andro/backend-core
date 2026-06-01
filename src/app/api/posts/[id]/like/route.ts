import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const sb = getSupabaseAdmin();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postIdStr } = await context.params;
  const postId = parseInt(postIdStr, 10);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const login = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const { data: dev } = await sb
    .from("developers")
    .select("id, github_token")
    .eq("github_login", login)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json({ error: "Developer profile not found" }, { status: 404 });
  }

  // Check if post exists in Supabase staging
  const { data: postExists } = await sb
    .from("social_posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();

  if (!postExists) {
    // Post has been synced to GitHub and deleted from Supabase.
    // 1. Find the post from GitHub Raw Content
    let postData = null;
    try {
      const org = process.env.GITHUB_ORGANIZATION || "cl-andro";
      const repo = process.env.GITHUB_MAIN_REPO || "backend-core";
      const feedUrl = `https://raw.githubusercontent.com/${org}/${repo}/main/public/feeds/home.json`;

      const feedRes = await fetch(feedUrl, {
        next: { revalidate: 10 }
      });

      if (feedRes.ok) {
        const feed = await feedRes.json();
        postData = feed.find((p: any) => p.id === postId);
      }
    } catch (err) {
      console.error("Error reading static feed for like from GitHub Raw:", err);
    }

    if (!postData || !postData.github_issue_number || !postData.developer?.assigned_repo) {
      return NextResponse.json({ error: "Post not found or not synced yet" }, { status: 404 });
    }

    const userToken = dev?.github_token || undefined;

    // 2. Toggle reaction on GitHub Issues
    const { toggleGitHubIssueReaction } = await import("@/lib/github-api");
    const ghRes = await toggleGitHubIssueReaction(
      postData.developer.assigned_repo,
      postData.github_issue_number,
      login,
      userToken
    );

    if (!ghRes.success) {
      return NextResponse.json({ error: ghRes.error || "Failed to toggle reaction on GitHub" }, { status: 500 });
    }

    return NextResponse.json({ liked: ghRes.liked });
  }

  // Check if like already exists in Supabase (for staging posts)
  const { data: existingLike } = await sb
    .from("social_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("developer_id", dev.id)
    .maybeSingle();

  if (existingLike) {
    // Unlike in Supabase
    const { error: deleteError } = await sb
      .from("social_likes")
      .delete()
      .eq("post_id", postId)
      .eq("developer_id", dev.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ liked: false });
  } else {
    // Like in Supabase
    const { error: insertError } = await sb
      .from("social_likes")
      .insert({
        post_id: postId,
        developer_id: dev.id,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ liked: true });
  }
}
