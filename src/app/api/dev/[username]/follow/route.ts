import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { commitFileToGitHub, fetchFileFromGitHub, deleteFileFromGitHub } from "@/lib/github-api";

async function getAuthDevAndToken() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { dev: null, token: null, error: "Unauthorized" };

  const login = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, assigned_repo, github_token")
    .eq("github_login", login)
    .maybeSingle();

  if (!dev) return { dev: null, token: null, error: "Developer profile not found" };
  if (!dev.github_token) return { dev, token: null, error: "GitHub token missing" };

  return { dev, token: dev.github_token };
}

// GET /api/dev/[username]/follow - Check if following target user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: targetUsername } = await params;
  
  try {
    const { dev, token, error } = await getAuthDevAndToken();
    if (error || !dev) {
      // Fallback to unauthenticated public check if token isn't in DB/session
      const res = await fetch(`https://api.github.com/users/unknown/following/${encodeURIComponent(targetUsername)}`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      return NextResponse.json({ isFollowing: res.status === 204 });
    }

    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(dev.github_login)}/following/${encodeURIComponent(targetUsername)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    return NextResponse.json({ isFollowing: res.status === 204 });
  } catch (err) {
    console.error("Error checking following status on server:", err);
    return NextResponse.json({ isFollowing: false });
  }
}

// POST /api/dev/[username]/follow - Follow target user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: targetUsername } = await params;

  try {
    const { dev: myDev, token, error } = await getAuthDevAndToken();
    if (error || !myDev) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: error === "Unauthorized" ? 401 : 400 });
    }

    // 1. Instantly follow them on GitHub.com via OAuth
    const res = await fetch(
      `https://api.github.com/user/following/${encodeURIComponent(targetUsername)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Length": "0",
        },
      }
    );

    if (res.status === 204) {
      // 2. Commit follow records to assigned repos asynchronously
      try {
        const sb = getSupabaseAdmin();
        const { data: targetDev } = await sb
          .from("developers")
          .select("github_login, assigned_repo")
          .eq("github_login", targetUsername.toLowerCase())
          .maybeSingle();

        if (myDev.assigned_repo && targetDev?.assigned_repo) {
          const timestamp = new Date().toISOString();
          
          // Write to my "following" list
          await commitFileToGitHub(
            myDev.assigned_repo,
            `following/${targetDev.github_login}.json`,
            JSON.stringify({ followed_at: timestamp }),
            `follow: @${targetDev.github_login}`
          );

          // Write to target's "followers" list
          await commitFileToGitHub(
            targetDev.assigned_repo,
            `followers/${myDev.github_login}.json`,
            JSON.stringify({ follower_at: timestamp }),
            `follower: @${myDev.github_login}`
          );
        }
      } catch (syncErr) {
        console.error("Error syncing follow directories in user repos:", syncErr);
      }

      return NextResponse.json({ success: true });
    } else if (res.status === 403 || res.status === 401 || res.status === 404) {
      return NextResponse.json({ error: "insufficient_scope", message: "Scopes are missing or token is invalid" }, { status: 403 });
    } else {
      return NextResponse.json({ error: `GitHub API returned ${res.status}` }, { status: 500 });
    }
  } catch (err) {
    console.error("Error following user on server:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/dev/[username]/follow - Unfollow target user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: targetUsername } = await params;

  try {
    const { dev: myDev, token, error } = await getAuthDevAndToken();
    if (error || !myDev) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: error === "Unauthorized" ? 401 : 400 });
    }

    // 1. Instantly unfollow them on GitHub.com via OAuth
    const res = await fetch(
      `https://api.github.com/user/following/${encodeURIComponent(targetUsername)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (res.status === 204) {
      // 2. Delete follow records from assigned repos asynchronously
      try {
        const sb = getSupabaseAdmin();
        const { data: targetDev } = await sb
          .from("developers")
          .select("github_login, assigned_repo")
          .eq("github_login", targetUsername.toLowerCase())
          .maybeSingle();

        if (myDev.assigned_repo && targetDev?.assigned_repo) {
          const followingPath = `following/${targetDev.github_login}.json`;
          const followerPath = `followers/${myDev.github_login}.json`;

          // Delete from my "following" list
          const followingFile = await fetchFileFromGitHub(myDev.assigned_repo, followingPath);
          if (followingFile.success && followingFile.sha) {
            await deleteFileFromGitHub(
              myDev.assigned_repo,
              followingPath,
              `unfollow: @${targetDev.github_login}`,
              followingFile.sha
            );
          }

          // Delete from target's "followers" list
          const followerFile = await fetchFileFromGitHub(targetDev.assigned_repo, followerPath);
          if (followerFile.success && followerFile.sha) {
            await deleteFileFromGitHub(
              targetDev.assigned_repo,
              followerPath,
              `unfollower: @${myDev.github_login}`,
              followerFile.sha
            );
          }
        }
      } catch (syncErr) {
        console.error("Error syncing unfollow directories in user repos:", syncErr);
      }

      return NextResponse.json({ success: true });
    } else if (res.status === 403 || res.status === 401 || res.status === 404) {
      return NextResponse.json({ error: "insufficient_scope", message: "Scopes are missing or token is invalid" }, { status: 403 });
    } else {
      return NextResponse.json({ error: `GitHub API returned ${res.status}` }, { status: 500 });
    }
  } catch (err) {
    console.error("Error unfollowing user on server:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
