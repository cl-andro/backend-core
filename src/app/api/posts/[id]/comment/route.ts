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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
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
      console.error("Error reading static feed for comment from GitHub Raw:", err);
    }

    if (!postData || !postData.github_issue_number || !postData.developer?.assigned_repo) {
      return NextResponse.json({ error: "Post not found or not synced yet" }, { status: 404 });
    }

    const userToken = dev?.github_token || undefined;

    // 2. Create comment directly on GitHub Issues
    const { createGitHubIssueComment } = await import("@/lib/github-api");
    const ghRes = await createGitHubIssueComment(
      postData.developer.assigned_repo,
      postData.github_issue_number,
      content.trim(),
      userToken
    );

    if (!ghRes.success || !ghRes.comment) {
      return NextResponse.json({ error: ghRes.error || "Failed to comment on GitHub" }, { status: 500 });
    }

    // Return comment formatted for frontend consumption
    return NextResponse.json({
      comment: {
        id: ghRes.comment.id,
        content: content.trim(),
        created_at: ghRes.comment.created_at,
        developer: {
          id: dev.id,
          github_login: login,
          name: user.user_metadata?.name || login,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      },
    });
  }

  // Insert comment into Supabase (for staging posts)
  const { data: comment, error: insertError } = await sb
    .from("social_comments")
    .insert({
      post_id: postId,
      developer_id: dev.id,
      content: content.trim(),
    })
    .select(`
      id,
      content,
      created_at,
      developer:developers(id, github_login, name, avatar_url)
    `)
    .single();

  if (insertError) {
    console.error("Error inserting comment:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ comment });
}
