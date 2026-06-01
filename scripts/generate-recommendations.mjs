#!/usr/bin/env node

import fs from "fs";

// Polyfill global WebSocket for Supabase Client initialization in Node < 22
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {};
}

// Load environment variables from .env.local if present (local testing)
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
    // Expected in CI/Actions where env vars are set directly
  }
};

loadEnv();

const githubToken = process.env.GITHUB_TOKEN;
const githubOrg = process.env.GITHUB_ORGANIZATION;

if (!githubToken || !githubOrg) {
  console.error("Missing GITHUB_TOKEN or GITHUB_ORGANIZATION environment variables.");
  process.exit(1);
}

// Helper to make a GitHub API call
async function ghFetch(urlPath, method = "GET", body = null) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "User-Agent": "git-social-recommendations",
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
    if (res.status === 404 && method === "GET") {
      return null; // Return null on 404 to handle missing files gracefully
    }
    const errText = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${errText}`);
  }
  return res.json();
}

async function run() {
  console.log("Loading candidates from global feed 'feed' repository...");

  const posts = [];
  
  // 1. Fetch latest 2 pages of posts (up to 200 posts) to score
  for (let page = 0; page < 2; page++) {
    try {
      const chunkPath = `home_${page}.json`;
      const res = await ghFetch(`/repos/${githubOrg}/feed/contents/${chunkPath}`);
      if (res && res.content) {
        const pagePosts = JSON.parse(Buffer.from(res.content, "base64").toString("utf-8"));
        posts.push(...pagePosts);
        console.log(`Loaded ${pagePosts.length} posts from page ${page}`);
      }
    } catch (err) {
      console.warn(`Could not load page ${page} from global feed: ${err.message}`);
    }
  }

  if (posts.length === 0) {
    console.log("No posts found in feed. Exiting.");
    process.exit(0);
  }

  // Deduplicate posts by ID
  const uniquePostsMap = new Map();
  for (const post of posts) {
    uniquePostsMap.set(post.id, post);
  }
  const candidatePosts = Array.from(uniquePostsMap.values());
  console.log(`Total candidate posts for ranking: ${candidatePosts.length}`);

  const scoredPosts = [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 2. Fetch engagement counts and score each post
  for (const post of candidatePosts) {
    const dev = post.developer;
    const isRecent = new Date(post.created_at).getTime() > sevenDaysAgo;
    
    let likes = 0;
    let comments = 0;

    if (isRecent && dev && dev.assigned_repo && post.github_issue_number) {
      try {
        // Fetch comments and reaction counts in a single issue lookup
        const issue = await ghFetch(`/repos/${githubOrg}/${dev.assigned_repo}/issues/${post.github_issue_number}`);
        if (issue) {
          comments = issue.comments ?? 0;
          likes = issue.reactions?.["+1"] ?? 0;
        }
        // Small rate limit delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        console.warn(`Failed to fetch engagement for post ${post.id}: ${err.message}`);
      }
    }

    // Exponential Time Decay Scoring (Twitter Algorithm inspired)
    // Score = (Likes * 30 + Comments * 75 + 1) / (AgeInHours + 2) ^ 1.8
    const ageInHours = (now - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    const score = (likes * 30 + comments * 75 + 1) / Math.pow(ageInHours + 2, 1.8);

    scoredPosts.push({
      ...post,
      score,
      engagement: { likes, comments }
    });
  }

  // Sort candidates by score descending
  scoredPosts.sort((a, b) => b.score - a.score);

  // 3. Apply Interleaving / Author Diversity Filter
  // Ensure that no single author has more than 2 consecutive posts in the feed
  const diverseFeed = [];
  const deferred = [];
  let consecutiveCount = 0;
  let lastAuthor = null;

  const queue = [...scoredPosts];

  while (queue.length > 0 || deferred.length > 0) {
    if (queue.length === 0) {
      // If the main queue is empty, append all deferred items to the end
      diverseFeed.push(...deferred);
      break;
    }

    const post = queue.shift();
    const author = post.developer?.github_login;

    if (author && author === lastAuthor) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
      lastAuthor = author;
    }

    if (consecutiveCount > 2) {
      deferred.push(post);
    } else {
      diverseFeed.push(post);
    }
  }

  console.log(`Generated recommended feed with ${diverseFeed.length} posts.`);

  // 4. Update the recommended feed pages in the 'feed' repo
  await updatePaginatedFeed("feed", "recommended", diverseFeed);

  console.log("Recommendation process completed successfully.");
}

async function updatePaginatedFeed(repoName, fileNamePrefix, posts) {
  let currentPage = 0;
  let remainingPosts = [...posts];

  while (remainingPosts.length > 0) {
    const chunkPath = `${fileNamePrefix}_${currentPage}.json`;
    const stays = remainingPosts.slice(0, 100);
    const leftovers = remainingPosts.slice(100);

    let pageSha = null;
    try {
      const res = await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${chunkPath}`);
      if (res) {
        pageSha = res.sha;
      }
    } catch (err) {
      // File doesn't exist yet, which is fine
    }

    const base64Content = Buffer.from(JSON.stringify(stays, null, 2)).toString("base64");
    
    await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${chunkPath}`, "PUT", {
      message: `Update ${chunkPath} recommended feed (page ${currentPage})`,
      content: base64Content,
      sha: pageSha || undefined
    });
    
    console.log(`Uploaded ${repoName}/${chunkPath} with ${stays.length} recommended posts`);

    remainingPosts = leftovers;
    currentPage++;
  }
}

run();
