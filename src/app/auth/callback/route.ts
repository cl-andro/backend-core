import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkAchievements } from "@/lib/achievements";
import { cacheEmailFromAuth, touchLastActive, ensurePreferences } from "@/lib/notification-helpers";
import { sendWelcomeNotification } from "@/lib/notification-senders/welcome";
import { sendReferralJoinedNotification } from "@/lib/notification-senders/referral";
import { fetchGitHubDeveloperData, createUserRepoForDev, setupUserRepoCollaborator } from "@/lib/github-api";
import { calculateGithubXp } from "@/lib/xp";

// Extend timeout for GitHub API calls during login
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3001";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Debug logging
  try {
    const fs = require("fs");
    const path = require("path");
    const logMsg = `[${new Date().toISOString()}] CALLBACK: User: ${data?.user?.email || "unknown"} | Error: ${error?.message || "none"} | Has Session: ${!!data?.session} | Has Provider Token: ${!!data?.session?.provider_token} | Provider Token Preview: ${data?.session?.provider_token ? data.session.provider_token.substring(0, 10) + "..." : "none"}\n`;
    fs.appendFileSync(path.join(process.cwd(), "debug_oauth.txt"), logMsg);
  } catch (e) {}

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const githubLogin = (
    data.user.user_metadata.user_name ??
    data.user.user_metadata.preferred_username ??
    ""
  ).toLowerCase();

  const admin = getSupabaseAdmin();

  if (githubLogin) {
    // Check if dev already exists in the database
    const { data: existingDev } = await admin
      .from("developers")
      .select("id, claimed, assigned_repo")
      .eq("github_login", githubLogin)
      .maybeSingle();

if (!existingDev) {
      // ─── New dev: create building from GitHub data on login ───
      try {
        const ghData = await fetchGitHubDeveloperData(githubLogin, { allowEmpty: true });

        const { data: created, error: createErr } = await admin
          .from("developers")
          .upsert({
            ...ghData,
            fetched_at: new Date().toISOString(),
            claimed: true,
            claimed_by: data.user.id,
            claimed_at: new Date().toISOString(),
            fetch_priority: 1,
            github_token: data.session?.provider_token || null,
          }, { onConflict: "github_login" })
          .select("id");

        if (created && created.length > 0 && !createErr) {
          const createdId = created[0].id;
          // Create a personal repository for the user in the organization
          const repoName = `social-${githubLogin}`;
          const repoResult = await createUserRepoForDev(githubLogin, repoName);
          
          if (repoResult.success) {
            // Update the developer record with the assigned repository info
            await admin
              .from("developers")
              .update({
                assigned_repo: repoName,
                assigned_repo_url: repoResult.repoUrl,
                repo_assigned_at: new Date().toISOString(),
              })
              .eq("id", createdId);

            if (data.session?.provider_token) {
              setupUserRepoCollaborator(githubLogin, repoName, data.session.provider_token).catch((err) => {
                console.error(`Failed to setup collaborator permissions for new dev @${githubLogin}:`, err);
              });
            }
          } else {
            console.warn("Failed to create user repository:", repoResult.error);
          }
          // GitHub XP
          const xp = calculateGithubXp({
            contributions: ghData.contributions_total ?? ghData.contributions,
            total_stars: ghData.total_stars,
            public_repos: ghData.public_repos,
            total_prs: ghData.total_prs ?? 0,
          });
          if (xp > 0) {
            await admin.rpc("grant_xp", { p_developer_id: createdId, p_source: "github", p_amount: xp });
            await admin.from("developers").update({ xp_github: xp }).eq("id", createdId);
          }

          // Rank
          await admin.rpc("assign_new_dev_rank", { dev_id: createdId });
          admin.rpc("recalculate_ranks").then(
            () => console.log("Ranks recalculated for new dev:", githubLogin),
            (err: unknown) => console.error("Rank recalculation failed:", err),
          );

          // Feed event
          await admin.from("activity_feed").insert({
            event_type: "dev_joined",
            actor_id: createdId,
            metadata: { login: githubLogin },
          });

          // Notifications
          cacheEmailFromAuth(createdId, data.user.id).catch(() => {});
          ensurePreferences(createdId).catch(() => {});
          sendWelcomeNotification(createdId, githubLogin);
        }
      } catch (err) {
        console.error("Failed to create dev on login:", err);
      }
    } else if (!existingDev.claimed) {
      // ─── Legacy dev: claim existing unclaimed building ───
      const claimUpdates: any = {
        claimed: true,
        claimed_by: data.user.id,
        claimed_at: new Date().toISOString(),
        fetch_priority: 1,
      };
      if (data.session?.provider_token) {
        claimUpdates.github_token = data.session.provider_token;
      }
      await admin
        .from("developers")
        .update(claimUpdates)
        .eq("id", existingDev.id)
        .eq("claimed", false);

      // Create a personal repository for the user if they don't have one already
      if (!existingDev.assigned_repo) {
        const repoName = `social-${githubLogin}`;
        const repoResult = await createUserRepoForDev(githubLogin, repoName);
        
        if (repoResult.success) {
          // Update the developer record with the assigned repository info
          await admin
            .from("developers")
            .update({
              assigned_repo: repoName,
              assigned_repo_url: repoResult.repoUrl,
              repo_assigned_at: new Date().toISOString(),
            })
            .eq("id", existingDev.id);

          if (data.session?.provider_token) {
            setupUserRepoCollaborator(githubLogin, repoName, data.session.provider_token).catch((err) => {
              console.error(`Failed to setup collaborator permissions for claimed dev @${githubLogin}:`, err);
            });
          }
        } else {
          console.warn("Failed to create user repository for existing dev:", repoResult.error);
        }
      }

      await admin.from("activity_feed").insert({
        event_type: "dev_joined",
        actor_id: existingDev.id,
        metadata: { login: githubLogin },
      });

      cacheEmailFromAuth(existingDev.id, data.user.id).catch(() => {});
      ensurePreferences(existingDev.id).catch(() => {});
      sendWelcomeNotification(existingDev.id, githubLogin);
    }

    // Fetch dev record for achievement check + referral processing
    // Uses try-catch to avoid breaking login if v2 columns/tables don't exist yet
    try {
      const { data: dev } = await admin
        .from("developers")
        .select("id, assigned_repo, contributions, public_repos, total_stars, kudos_count, referral_count, referred_by")
        .eq("github_login", githubLogin)
        .single();

      if (dev) {
        // Update github token if present on login
        if (data.session?.provider_token) {
          await admin
            .from("developers")
            .update({ github_token: data.session.provider_token })
            .eq("id", dev.id);
        }

        if (dev.assigned_repo && data.session?.provider_token) {
          setupUserRepoCollaborator(githubLogin, dev.assigned_repo, data.session.provider_token).catch((err) => {
            console.error(`Failed to verify collaborator permissions for @${githubLogin}:`, err);
          });
        }

        cacheEmailFromAuth(dev.id, data.user.id).catch(() => {});
        touchLastActive(dev.id);

        // Process referral (from ?ref= param forwarded by client)
        const ref = searchParams.get("ref");
        if (ref && ref !== githubLogin && !dev.referred_by) {
          const { data: referrer } = await admin
            .from("developers")
            .select("id, github_login")
            .eq("github_login", ref.toLowerCase())
            .single();

          if (referrer) {
            await admin
              .from("developers")
              .update({ referred_by: referrer.github_login })
              .eq("id", dev.id);

            await admin.rpc("increment_referral_count", { referrer_dev_id: referrer.id });

            await admin.from("activity_feed").insert({
              event_type: "referral",
              actor_id: referrer.id,
              target_id: dev.id,
              metadata: { referrer_login: referrer.github_login, referred_login: githubLogin },
            });

            // Notify referrer that their referral joined
            sendReferralJoinedNotification(referrer.id, referrer.github_login, githubLogin, dev.id);

            // Check referral achievements for the referrer
            const { data: referrerFull } = await admin
              .from("developers")
              .select("referral_count, kudos_count, contributions, public_repos, total_stars")
              .eq("id", referrer.id)
              .single();

            if (referrerFull) {
              const giftsSent = await countGifts(admin, referrer.id, "sent");
              const giftsReceived = await countGifts(admin, referrer.id, "received");
              await checkAchievements(referrer.id, {
                contributions: referrerFull.contributions,
                public_repos: referrerFull.public_repos,
                total_stars: referrerFull.total_stars,
                referral_count: referrerFull.referral_count,
                kudos_count: referrerFull.kudos_count,
                gifts_sent: giftsSent,
                gifts_received: giftsReceived,
              }, referrer.github_login);
            }
          }
        }

        // Run achievement check for this developer
        const giftsSent = await countGifts(admin, dev.id, "sent");
        const giftsReceived = await countGifts(admin, dev.id, "received");
        await checkAchievements(dev.id, {
          contributions: dev.contributions,
          public_repos: dev.public_repos,
          total_stars: dev.total_stars,
          referral_count: dev.referral_count ?? 0,
          kudos_count: dev.kudos_count ?? 0,
          gifts_sent: giftsSent,
          gifts_received: giftsReceived,
        }, githubLogin);
      }
    } catch {
      // Silently skip v2 features if tables/columns don't exist yet
      console.warn("Auth callback: skipping v2 achievement/referral check (migration may not have run)");
    }
  }

  // Support ?next= param for post-login redirect
  const next = searchParams.get("next");
  if (next && githubLogin) {
    if (next.startsWith("gitsocial://")) {
      const accessToken = data.session?.access_token || "";
      const refreshToken = data.session?.refresh_token || "";
      
      const schemeUrl = `gitsocial://auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}`;
      const intentUrl = `intent://auth/callback?access_token=${accessToken}&refresh_token=${refreshToken}#Intent;scheme=gitsocial;package=com.gitcity.social;end`;
      
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GitSocial Authentication</title>
          <style>
            body {
              background-color: #060814;
              color: #f8d880;
              font-family: monospace;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
              text-align: center;
            }
            .card {
              border: 3px solid #c8e64a;
              background-color: #0d0f22;
              padding: 40px;
              max-width: 400px;
              box-shadow: 0 0 20px rgba(200, 230, 74, 0.2);
            }
            h1 {
              color: #c8e64a;
              font-size: 20px;
              margin-top: 0;
              letter-spacing: 2px;
            }
            p {
              font-size: 12px;
              color: #8892b0;
              line-height: 1.6;
            }
            .btn {
              display: inline-block;
              margin-top: 25px;
              padding: 12px 24px;
              background-color: #c8e64a;
              color: #060814;
              text-decoration: none;
              font-weight: bold;
              font-size: 12px;
              border: none;
              cursor: pointer;
              box-shadow: 4px 4px 0 0 #5a7a00;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .btn:active {
              transform: translate(2px, 2px);
              box-shadow: 2px 2px 0 0 #5a7a00;
            }
            .loader {
              margin: 20px auto;
              width: 30px;
              height: 30px;
              border: 3px solid #1f2937;
              border-top: 3px solid #c8e64a;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AUTH SUCCESSFUL</h1>
            <div class="loader"></div>
            <p>Authentication complete. We are redirecting you back to the app.</p>
            <p style="font-size: 10px; color: #5a6578;">If the app does not open automatically in 3 seconds, click the button below:</p>
            <a href="${intentUrl}" class="btn">Return to GitSocial</a>
          </div>
           <script>
            // Attempt auto-redirect on load
            window.onload = function() {
              var userAgent = navigator.userAgent || navigator.vendor || window.opera;
              var isAndroid = /android/i.test(userAgent);
              var targetUrl = isAndroid ? "${intentUrl}" : "${schemeUrl}";
              setTimeout(function() {
                window.location.href = targetUrl;
              }, 500);
            };
          </script>
        </body>
        </html>`,
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    // Special case: /shop redirects to /shop/{username}
    if (next === "/shop") {
      const { data: dev } = await admin
        .from("developers")
        .select("github_login")
        .eq("github_login", githubLogin)
        .single();

      if (!dev) {
        return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
      }

      return NextResponse.redirect(`${origin}/shop/${githubLogin}`);
    }

    // General redirect: only allow relative paths
    if (next.startsWith("/")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?user=${githubLogin}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countGifts(admin: any, devId: number, direction: "sent" | "received"): Promise<number> {
  const column = direction === "sent" ? "developer_id" : "gifted_to";
  const { count } = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq(column, devId)
    .eq("status", "completed")
    .not("gifted_to", "is", null);
  return count ?? 0;
}
