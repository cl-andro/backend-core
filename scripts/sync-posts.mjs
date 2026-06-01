#!/usr/bin/env node

import fs from "fs";
import path from "path";

// Polyfill global WebSocket for Supabase Client initialization in Node < 22
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {};
}

import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
const loadEnv = () => {
  try {
    const envFile = fs.readFileSync(".env.local", "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch (err) {
    console.warn("Could not read .env.local file. Proceeding with process.env...");
  }
};

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const githubToken = process.env.GITHUB_TOKEN;
const githubOrg = process.env.GITHUB_ORGANIZATION;

if (!supabaseUrl || !supabaseKey || !githubToken || !githubOrg) {
  console.error("Missing configuration. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, and GITHUB_ORGANIZATION are set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// Helper to make a GitHub API call
async function ghFetch(urlPath, method = "GET", body = null) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "User-Agent": "git-social-sync",
  };
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`https://api.github.com${urlPath}`, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${errText}`);
  }
  return res.json();
}

async function run() {
  console.log("Checking for staging posts in Supabase...");

  // 1. Fetch posts from Supabase that need syncing
  const { data: posts, error } = await supabase
    .from("social_posts")
    .select(`
      id,
      content,
      github_issue_number,
      user_synced,
      created_at,
      developer:developers(id, github_login, name, avatar_url, assigned_repo, assigned_repo_url)
    `)
    .order("created_at", { ascending: true }); // process oldest first

  if (error) {
    console.error("Error fetching posts from Supabase:", error);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log("No new posts to sync.");
    process.exit(0);
  }

  console.log(`Found ${posts.length} posts to sync.`);

  const postsToSyncGlobal = [];
  const syncedPostIds = [];

  for (const post of posts) {
    const dev = post.developer;
    if (!dev || !dev.assigned_repo) {
      console.warn(`Post ${post.id} skipped: developer has no assigned repo.`);
      continue;
    }

    try {
      console.log(`Syncing post ${post.id} for @${dev.github_login}...`);
      
      // Formulate post structure
      let issueNumber = post.github_issue_number;
      if (!issueNumber) {
        const title = post.content.trim().split("\n")[0].substring(0, 50) || `Post by @${dev.github_login}`;
        const issueRes = await ghFetch(`/repos/${githubOrg}/${dev.assigned_repo}/issues`, "POST", {
          title,
          body: post.content.trim()
        });
        issueNumber = issueRes.number;
        console.log(`Created GitHub Issue #${issueNumber} on ${dev.assigned_repo}`);
      }

      const postData = {
        id: post.id,
        content: post.content.trim(),
        github_issue_number: issueNumber,
        created_at: post.created_at,
        developer: {
          id: dev.id,
          github_login: dev.github_login,
          name: dev.name,
          avatar_url: dev.avatar_url,
          assigned_repo: dev.assigned_repo,
          assigned_repo_url: dev.assigned_repo_url
        }
      };

      if (post.user_synced) {
        console.log(`Post ${post.id} is already synced to user repository directly. Collecting for global feed.`);
        postsToSyncGlobal.push(postData);
        syncedPostIds.push(post.id);
        continue;
      }
      
      // Step 2a: Commit JSON file to user's assigned repository
      const date = new Date(post.created_at);
      const year = date.getFullYear();
      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const month = monthNames[date.getMonth()];
      const day = String(date.getDate()).padStart(2, "0");
      const gitPath = `posts/${year}/${month}/${day}/${post.id}.json`;

      const commitMessage = `Add post ${post.id} via GitSocial`;
      const base64Content = Buffer.from(JSON.stringify(postData, null, 2)).toString("base64");

      await ghFetch(`/repos/${githubOrg}/${dev.assigned_repo}/contents/${gitPath}`, "PUT", {
        message: commitMessage,
        content: base64Content
      });
      console.log(`Committed post to ${dev.assigned_repo}/${gitPath}`);

      // Step 2b: Append to user's static feed in their repo with pagination chunking
      await updatePaginatedFeed(dev.assigned_repo, "feed", [postData]);

      // Collect for global feed
      postsToSyncGlobal.push(postData);
      syncedPostIds.push(post.id);

    } catch (err) {
      console.error(`Failed to sync post ${post.id}:`, err);
    }
  }

  // Step 3: Update global feed in separate 'feed' repo with pagination chunking
  if (postsToSyncGlobal.length > 0) {
    console.log(`Updating global feed in repository 'feed' with ${postsToSyncGlobal.length} posts...`);
    try {
      await updatePaginatedFeed("feed", "home", postsToSyncGlobal);
    } catch (err) {
      console.error("Failed to update global feed repository:", err);
    }
  }

  // Step 4: Delete synced posts from Supabase!
  if (syncedPostIds.length > 0) {
    console.log(`Deleting ${syncedPostIds.length} synced posts from Supabase...`);
    const { error: deleteErr } = await supabase
      .from("social_posts")
      .delete()
      .in("id", syncedPostIds);

    if (deleteErr) {
      console.error("Error deleting synced posts from Supabase:", deleteErr);
    } else {
      console.log("Successfully cleaned up synced posts from Supabase.");
    }
  }

  console.log("Sync process completed.");
}

async function updatePaginatedFeed(repoName, fileNamePrefix, newPosts) {
  if (newPosts.length === 0) return;

  let currentPage = 0;
  let currentIncoming = [...newPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  while (currentIncoming.length > 0) {
    const chunkPath = `${fileNamePrefix}_${currentPage}.json`;
    let existingPosts = [];
    let pageSha = null;

    try {
      const res = await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${chunkPath}`);
      pageSha = res.sha;
      existingPosts = JSON.parse(Buffer.from(res.content, "base64").toString("utf-8"));
    } catch (err) {
      // file doesn't exist yet, which is fine
    }

    const incomingIds = new Set(currentIncoming.map(p => p.id));
    const filteredExisting = existingPosts.filter(p => !incomingIds.has(p.id));

    const merged = [...currentIncoming, ...filteredExisting];
    const stays = merged.slice(0, 100);
    const leftovers = merged.slice(100);

    const base64Content = Buffer.from(JSON.stringify(stays, null, 2)).toString("base64");
    await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${chunkPath}`, "PUT", {
      message: `Update ${chunkPath} (page ${currentPage})`,
      content: base64Content,
      sha: pageSha || undefined
    });
    console.log(`Updated ${repoName}/${chunkPath} with ${stays.length} posts`);

    currentIncoming = leftovers;
    currentPage++;
  }
}

run();

