import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { triggerSyncWorkflow, fetchGitHubIssueCommentsAndLikes, syncPostToUserRepoDirect } from "@/lib/github-api";

// GET /api/posts - Get news feed or user posts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const username = searchParams.get("username");
  const page = searchParams.get("page") || "0";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const recommended = searchParams.get("recommended") === "true";

  const sb = getSupabaseAdmin();
  const supabase = await createServerSupabase();

  // Get current logged in user to check liked_by_me
  const { data: { user } } = await supabase.auth.getUser();
  let currentDevId: number | null = null;
  if (user) {
    const login = (
      user.user_metadata?.user_name ??
      user.user_metadata?.preferred_username ??
      ""
    ).toLowerCase();
    const { data: currentDev } = await sb
      .from("developers")
      .select("id")
      .eq("github_login", login)
      .maybeSingle();
    if (currentDev) {
      currentDevId = currentDev.id;
    }
  }

  // 1. Fetch staging posts from Supabase (not yet synced/deleted)
  let query = sb
    .from("social_posts")
    .select(`
      id,
      content,
      github_issue_number,
      created_at,
      developer:developers(id, github_login, name, avatar_url, assigned_repo, assigned_repo_url),
      social_likes(developer_id),
      social_comments(
        id, 
        content, 
        created_at, 
        developer:developers(id, github_login, name, avatar_url, assigned_repo, assigned_repo_url)
      )
    `)
    .order("created_at", { ascending: false });

  // Filter by a specific developer's username in staging query
  if (username) {
    const { data: filterDev } = await sb
      .from("developers")
      .select("id")
      .eq("github_login", username.toLowerCase())
      .maybeSingle();

    if (filterDev) {
      query = query.eq("developer_id", filterDev.id);
    } else {
      // If user profile is queried but doesn't exist locally, we return empty staging posts
      query = query.eq("id", -1); // returns empty
    }
  }

  let stagingPostsRaw: any[] = [];
  if (page === "0") {
    const { data } = await query;
    stagingPostsRaw = data ?? [];
  }
  
  // Format staging posts
  const stagingPosts = (stagingPostsRaw ?? []).map((post: any) => {
    const likes = post.social_likes ?? [];
    const comments = post.social_comments ?? [];
    const sortedComments = [...comments].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return {
      id: post.id,
      content: post.content,
      github_issue_number: post.github_issue_number,
      created_at: post.created_at,
      developer: post.developer,
      likes_count: likes.length,
      comments_count: comments.length,
      liked_by_me: currentDevId ? likes.some((l: any) => l.developer_id === currentDevId) : false,
      comments: sortedComments,
    };
  });

  // 2. Read synced posts from Cloudflare Worker feed or GitHub Raw Content fallback
  let staticPosts = [];
  const cfWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_FEED_URL;
  let feedUrl = "";
  const org = process.env.GITHUB_ORGANIZATION || "cl-andro";

  if (cfWorkerUrl) {
    if (username) {
      feedUrl = `${cfWorkerUrl.replace(/\/$/, "")}/user/${username.toLowerCase()}?page=${page}`;
    } else {
      feedUrl = `${cfWorkerUrl.replace(/\/$/, "")}/global?page=${page}${recommended ? "&recommended=true" : ""}`;
    }
  } else {
    // Fallback: fetch directly from GitHub Raw
    if (username) {
      feedUrl = `https://raw.githubusercontent.com/${org}/social-${username.toLowerCase()}/main/feed_${page}.json`;
    } else {
      if (recommended) {
        feedUrl = `https://raw.githubusercontent.com/${org}/feed/main/recommended_${page}.json`;
      } else {
        feedUrl = `https://raw.githubusercontent.com/${org}/feed/main/home_${page}.json`;
      }
    }
  }

  try {
    let feedRes = await fetch(feedUrl, {
      next: { revalidate: 60 }
    });

    // Fallback: If recommended feed fetch fails (e.g. 404), fall back to standard feed
    if (!feedRes.ok && recommended && !username) {
      console.warn(`Recommended feed not found at ${feedUrl}. Falling back to standard home feed.`);
      if (cfWorkerUrl) {
        feedUrl = `${cfWorkerUrl.replace(/\/$/, "")}/global?page=${page}`;
      } else {
        feedUrl = `https://raw.githubusercontent.com/${org}/feed/main/home_${page}.json`;
      }
      feedRes = await fetch(feedUrl, {
        next: { revalidate: 60 }
      });
    }

    if (feedRes.ok) {
      staticPosts = await feedRes.json();
    } else {
      console.warn(`Failed to fetch static feed from ${feedUrl} (${feedRes.status}). Proceeding with empty list.`);
    }
  } catch (err) {
    console.error(`Error reading static feed from ${feedUrl}:`, err);
  }

  // Filter static posts by search term if requested
  let filteredStatic = staticPosts;
  if (search) {
    filteredStatic = filteredStatic.filter(
      (p: any) => p.content?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 3. Merge staging and static posts (deduplicating by post ID)
  const seenIds = new Set(stagingPosts.map(p => p.id));
  const mergedPosts = [...stagingPosts];
  for (const post of filteredStatic) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      // Initialize with default structures to prevent frontend crashes
      mergedPosts.push({
        ...post,
        comments: post.comments ?? [],
        likes_count: post.likes_count ?? 0,
        comments_count: post.comments_count ?? 0,
        liked_by_me: post.liked_by_me ?? false,
      });
    }
  }

  // Sort merged list
  if (recommended && !username) {
    // Staging posts are at the top (created_at descending), and static posts follow in recommended order.
    // So we do not sort the merged list.
  } else {
    // Sort merged list by created_at descending
    mergedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Apply final limit
  const limitedPosts = mergedPosts.slice(0, limit);

  // Fetch comments and reactions from GitHub for the static posts in the final list
  const currentDevLogin = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username;
  const posts = await Promise.all(
    limitedPosts.map(async (post: any) => {
      // Check if it's a static post that has been synced (it won't be in stagingPosts)
      const isStaging = stagingPosts.some((p) => p.id === post.id);
      if (!isStaging && post.github_issue_number && post.developer?.assigned_repo) {
        try {
          const ghData = await fetchGitHubIssueCommentsAndLikes(
            post.developer.assigned_repo,
            post.github_issue_number,
            currentDevLogin
          );
          return {
            ...post,
            comments: ghData.comments,
            likes_count: ghData.likesCount,
            liked_by_me: ghData.likedByMe,
            comments_count: ghData.comments.length,
          };
        } catch (err) {
          console.error(`Error loading GitHub comments for post ${post.id}:`, err);
        }
      }
      return post;
    })
  );

  return NextResponse.json({ posts });
}

// POST /api/posts - Create a new post
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const sb = getSupabaseAdmin();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const { data: dev } = await sb
    .from("developers")
    .select("id, assigned_repo, assigned_repo_url, github_token")
    .eq("github_login", login)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json({ error: "Developer profile not found" }, { status: 404 });
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

  // 1. Insert into Supabase (staging buffer)
  const { data: post, error: insertError } = await sb
    .from("social_posts")
    .insert({
      developer_id: dev.id,
      content: content.trim(),
    })
    .select("id, content, created_at")
    .single();

  if (insertError) {
    console.error("Error inserting post:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const userToken = dev?.github_token;
  let githubIssueNumber: number | null = null;
  let userSynced = false;

  // 2. Attempt direct push to GitHub using the user's token
  if (dev.assigned_repo && userToken) {
    try {
      const syncRes = await syncPostToUserRepoDirect(
        { id: post.id, content: post.content, created_at: post.created_at },
        {
          id: dev.id,
          github_login: login,
          name: user.user_metadata?.name || login,
          avatar_url: user.user_metadata?.avatar_url || null,
          assigned_repo: dev.assigned_repo,
          assigned_repo_url: dev.assigned_repo_url || null,
        },
        userToken
      );

      if (syncRes.issueNumber) {
        githubIssueNumber = syncRes.issueNumber;
        userSynced = syncRes.success;

        // Update post with issue number and synced status
        await sb
          .from("social_posts")
          .update({
            github_issue_number: githubIssueNumber,
            user_synced: userSynced,
          })
          .eq("id", post.id);

        if (syncRes.success) {
          console.log(`Successfully posted directly to GitHub Issue #${githubIssueNumber} for @${login}`);
        } else {
          console.error(`Direct GitHub sync created issue #${githubIssueNumber} but failed to commit JSON files. Saved issue number, falling back to background worker sync:`, syncRes.error);
        }
      } else {
        console.error("Direct GitHub sync failed completely (could not create issue), falling back to background worker sync:", syncRes.error);
      }
    } catch (syncErr) {
      console.error("Error executing direct GitHub sync:", syncErr);
    }
  }

  // 3. Trigger background worker to update the global feed (and perform fallback sync if user_synced is false)
  if (dev.assigned_repo) {
    triggerSyncWorkflow()
      .then((res) => {
        if (!res.success) {
          console.warn("Failed to trigger sync workflow:", res.error);
        } else {
          console.log("Successfully triggered GitHub sync workflow.");
        }
      })
      .catch((err) => {
        console.error("Error triggering sync workflow in background:", err);
      });
  }

  // Return the newly created post (shown instantly in client)
  return NextResponse.json({
    post: {
      ...post,
      github_issue_number: githubIssueNumber,
      developer: {
        id: dev.id,
        github_login: login,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
      likes_count: 0,
      comments_count: 0,
      liked_by_me: false,
      comments: [],
    }
  });
}

