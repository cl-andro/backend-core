import fs from "fs";
import path from "path";

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
    console.warn("Could not read .env.local file.");
  }
};

loadEnv();

const githubToken = process.env.GITHUB_TOKEN;
const githubOrg = process.env.GITHUB_ORGANIZATION || "cl-andro";

if (!githubToken) {
  console.error("GITHUB_TOKEN is missing in .env.local");
  process.exit(1);
}

async function ghFetch(urlPath, method = "GET", body = null) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "User-Agent": "git-social-migrator",
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

async function writeJsonToRepo(repoName, filePath, data) {
  let existingSha = null;
  try {
    const res = await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${filePath}`);
    existingSha = res.sha;
  } catch (err) {
    // File doesn't exist yet, which is fine
  }

  const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  await ghFetch(`/repos/${githubOrg}/${repoName}/contents/${filePath}`, "PUT", {
    message: `Migrate/Update ${filePath} with legacy posts`,
    content: base64Content,
    sha: existingSha || undefined,
  });
  console.log(`Successfully committed legacy posts to ${repoName}/${filePath}`);
}

async function run() {
  const homeJsonPath = path.join("public", "feeds", "home.json");
  if (!fs.existsSync(homeJsonPath)) {
    console.error("public/feeds/home.json does not exist. Cannot migrate.");
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(homeJsonPath, "utf-8"));
  console.log(`Found ${posts.length} total posts to migrate.`);

  // 1. Group posts by developer assigned repo
  const repoPostsMap = new Map();
  for (const post of posts) {
    const repoName = post.developer?.assigned_repo;
    if (!repoName) {
      console.warn(`Post ${post.id} has no assigned repository.`);
      continue;
    }
    if (!repoPostsMap.has(repoName)) {
      repoPostsMap.set(repoName, []);
    }
    repoPostsMap.get(repoName).push(post);
  }

  // 2. Commit feed_0.json to each developer repo
  for (const [repoName, devPosts] of repoPostsMap.entries()) {
    console.log(`Migrating ${devPosts.length} posts to ${repoName}/feed_0.json...`);
    try {
      await writeJsonToRepo(repoName, "feed_0.json", devPosts);
    } catch (err) {
      console.error(`Failed to migrate feed for ${repoName}:`, err.message);
    }
  }

  // 3. Commit home_0.json to cl-andro/feed repo
  console.log(`Migrating all ${posts.length} posts to 'feed' repository home_0.json...`);
  try {
    await writeJsonToRepo("feed", "home_0.json", posts);
  } catch (err) {
    console.error(`Failed to migrate global feed:`, err.message);
  }

  console.log("Migration complete.");
}

run();
