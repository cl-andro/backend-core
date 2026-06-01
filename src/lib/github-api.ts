import type { TopRepo } from "@/lib/github";

// ─── Constants ───────────────────────────────────────────────

export const FETCH_TIMEOUT_MS = 15_000;

// ─── Helpers ─────────────────────────────────────────────────

export function ghHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "git-city-app",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

export async function createUserRepoForDev(login: string, repoName: string, orgName?: string): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;
  
  if (!token) {
    return { success: false, error: "GitHub token not configured" };
  }
  
  if (!targetOrg) {
    return { success: false, error: "GitHub organization not specified" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/orgs/${encodeURIComponent(targetOrg)}/repos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          name: repoName,
          description: `Personal repository for ${login}'s social media posts`,
          private: false,
          has_issues: true,
          has_projects: true,
          has_wiki: false,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { 
        success: false, 
        error: `Failed to create repository: ${res.status} ${errorData.message || ''}`
      };
    }

    const repoData = await res.json();
    return { 
      success: true, 
      repoUrl: repoData.html_url 
    };
  } catch (err) {
    console.error("Error creating user repository:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unknown error" 
    };
  }
}

// ─── Expanded GitHub Data (GraphQL) ──────────────────────────

export interface ExpandedGitHubData {
  contributions: number;
  contributions_total: number;
  contribution_years: number[];
  total_prs: number;
  total_reviews: number;
  total_issues: number;
  repos_contributed_to: number;
  followers: number;
  following: number;
  organizations_count: number;
  account_created_at: string | null;
  current_streak: number;
  longest_streak: number;
  active_days_last_year: number;
  current_week_contributions: number;
}

function buildYearAliases(): string {
  const currentYear = new Date().getFullYear();
  const lines: string[] = [];
  for (let y = currentYear; y >= currentYear - 9; y--) {
    lines.push(`y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`);
  }
  return lines.join("\n    ");
}

function computeStreaks(weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>): {
  current_streak: number;
  longest_streak: number;
  active_days_last_year: number;
} {
  const allDays: { count: number; date: string }[] = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      allDays.push({ count: day.contributionCount, date: day.date });
    }
  }
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let active_days_last_year = 0;
  let longest_streak = 0;
  let currentRun = 0;

  for (const day of allDays) {
    if (day.count > 0) {
      active_days_last_year++;
      currentRun++;
      if (currentRun > longest_streak) longest_streak = currentRun;
    } else {
      currentRun = 0;
    }
  }

  let current_streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (let i = allDays.length - 1; i >= 0; i--) {
    const day = allDays[i];
    if (i === allDays.length - 1 && day.date !== today && day.date !== yesterday) break;
    if (i === allDays.length - 1 && day.count === 0 && day.date === today) continue;
    if (day.count > 0) {
      current_streak++;
    } else {
      break;
    }
  }

  return { current_streak, longest_streak, active_days_last_year };
}

export async function fetchExpandedGitHubData(login: string): Promise<ExpandedGitHubData | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const yearAliases = buildYearAliases();

  const query = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        followers { totalCount }
        following { totalCount }
        organizations(first: 1) { totalCount }
        repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST]) {
          totalCount
        }

        current: contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { contributionCount, date }
            }
          }
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
        }

        ${yearAliases}
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login } }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const currentCollection = user.current;
    const contributions = currentCollection?.contributionCalendar?.totalContributions ?? 0;

    const currentYear = new Date().getFullYear();
    let contributions_total = 0;
    const contribution_years: number[] = [];
    for (let y = currentYear; y >= currentYear - 9; y--) {
      const yearData = user[`y${y}`];
      const yearContribs = yearData?.contributionCalendar?.totalContributions ?? 0;
      if (yearContribs > 0) {
        contributions_total += yearContribs;
        contribution_years.push(y);
      }
    }

    const weeks = currentCollection?.contributionCalendar?.weeks ?? [];
    const streaks = computeStreaks(weeks);

    const now = new Date();
    const isoWeekStart = new Date(now);
    const dayOfWeek = now.getDay();
    isoWeekStart.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    isoWeekStart.setHours(0, 0, 0, 0);
    let current_week_contributions = 0;
    for (const week of weeks) {
      for (const day of week.contributionDays ?? []) {
        if (new Date(day.date) >= isoWeekStart) {
          current_week_contributions += day.contributionCount;
        }
      }
    }

    return {
      contributions,
      contributions_total,
      contribution_years,
      total_prs: currentCollection?.totalPullRequestContributions ?? 0,
      total_reviews: currentCollection?.totalPullRequestReviewContributions ?? 0,
      total_issues: currentCollection?.totalIssueContributions ?? 0,
      repos_contributed_to: user.repositoriesContributedTo?.totalCount ?? 0,
      followers: user.followers?.totalCount ?? 0,
      following: user.following?.totalCount ?? 0,
      organizations_count: user.organizations?.totalCount ?? 0,
      account_created_at: user.createdAt ?? null,
      ...streaks,
      current_week_contributions,
    };
  } catch {
    return null;
  }
}

// ─── Full Developer Fetch ────────────────────────────────────

export class GitHubFetchError extends Error {
  code: "not_found" | "organization" | "no_activity" | "rate_limit";
  status: number;
  constructor(code: GitHubFetchError["code"], message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface GitHubDeveloperData {
  github_login: string;
  github_id: number;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  contributions: number;
  public_repos: number;
  total_stars: number;
  primary_language: string | null;
  top_repos: TopRepo[];
  github_etag: string | null;
  contributions_total?: number;
  contribution_years?: number[];
  total_prs?: number;
  total_reviews?: number;
  total_issues?: number;
  repos_contributed_to?: number;
  followers?: number;
  following?: number;
  organizations_count?: number;
  account_created_at?: string | null;
  current_streak?: number;
  longest_streak?: number;
  active_days_last_year?: number;
  language_diversity?: number;
  current_week_contributions?: number;
  // Assigned repository for social media posts
  assigned_repo?: string;
  assigned_repo_url?: string;
}

/**
 * Fetch full developer data from GitHub REST + GraphQL APIs.
 * Throws GitHubFetchError for known error cases (404, org, no activity, rate limit).
 * @param allowEmpty - If true, skip the "no public activity" check (used during login).
 */
export async function fetchGitHubDeveloperData(
  login: string,
  options?: { allowEmpty?: boolean },
): Promise<GitHubDeveloperData> {
  const headers = ghHeaders();

  const userRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(login)}`,
    { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );

  if (!userRes.ok) {
    if (userRes.status === 404) throw new GitHubFetchError("not_found", "User not found", 404);
    if (userRes.status === 403) throw new GitHubFetchError("rate_limit", "GitHub API rate limit exceeded.", 429);
    throw new Error(`Failed to fetch user data (${userRes.status})`);
  }

  const ghUser = await userRes.json();

  if (ghUser.type === "Organization") {
    throw new GitHubFetchError("organization", "Organizations are not supported. Search for a user profile instead.", 400);
  }

  const resolvedLogin = ghUser.login;

  const [expanded, reposPage1Res] = await Promise.all([
    fetchExpandedGitHubData(resolvedLogin),
    fetch(
      `https://api.github.com/users/${encodeURIComponent(resolvedLogin)}/repos?sort=pushed&per_page=100&page=1`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    ),
  ]);

  const contributions = expanded?.contributions ?? 0;
  const publicRepos = ghUser.public_repos;

  if (!options?.allowEmpty && contributions === 0 && publicRepos === 0) {
    throw new GitHubFetchError("no_activity", "This user has no public activity on GitHub yet.", 400);
  }

  type RepoItem = { name: string; stargazers_count: number; language: string | null; html_url: string; fork: boolean; size: number };
  let repos: RepoItem[] = reposPage1Res.ok ? await reposPage1Res.json() : [];

  if (repos.length >= 100) {
    const page2Res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(resolvedLogin)}/repos?sort=pushed&per_page=100&page=2`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (page2Res.ok) {
      repos = repos.concat(await page2Res.json());
    }
  }

  const ownRepos = repos.filter((r) => !r.fork);
  const totalStars = ownRepos.reduce((s, r) => s + r.stargazers_count, 0);

  const langCounts: Record<string, number> = {};
  const uniqueLanguages = new Set<string>();
  for (const repo of ownRepos) {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + repo.size;
      uniqueLanguages.add(repo.language);
    }
  }
  const primaryLanguage = Object.entries(langCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  const topRepos: TopRepo[] = ownRepos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({ name: r.name, stars: r.stargazers_count, language: r.language, url: r.html_url }));

  return {
    github_login: resolvedLogin.toLowerCase(),
    github_id: ghUser.id,
    name: ghUser.name,
    avatar_url: ghUser.avatar_url,
    bio: ghUser.bio,
    contributions,
    public_repos: publicRepos,
    total_stars: totalStars,
    primary_language: primaryLanguage,
    top_repos: topRepos,
    github_etag: userRes.headers.get("etag"),
    ...(expanded ? {
      contributions_total: expanded.contributions_total,
      contribution_years: expanded.contribution_years,
      total_prs: expanded.total_prs,
      total_reviews: expanded.total_reviews,
      total_issues: expanded.total_issues,
      repos_contributed_to: expanded.repos_contributed_to,
      followers: expanded.followers,
      following: expanded.following,
      organizations_count: expanded.organizations_count,
      account_created_at: expanded.account_created_at,
      current_streak: expanded.current_streak,
      longest_streak: expanded.longest_streak,
      active_days_last_year: expanded.active_days_last_year,
      language_diversity: uniqueLanguages.size,
      current_week_contributions: expanded.current_week_contributions,
    } : {}),
    // Assigned repository fields (will be populated from DB if exists)
    assigned_repo: undefined,
    assigned_repo_url: undefined,
  };
}

export async function createGitHubIssue(
  repoName: string,
  title: string,
  body: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; issueNumber?: number; issueUrl?: string; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token) {
    return { success: false, error: "GitHub token not configured" };
  }

  if (!targetOrg) {
    return { success: false, error: "GitHub organization not specified" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          title,
          body,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `Failed to create issue: ${res.status} ${errorData.message || ""}`,
      };
    }

    const issueData = await res.json();
    return {
      success: true,
      issueNumber: issueData.number,
      issueUrl: issueData.html_url,
    };
  } catch (err) {
    console.error("Error creating GitHub issue:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function commitFileToGitHub(
  repoName: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token) {
    return { success: false, error: "GitHub token not configured" };
  }

  if (!targetOrg) {
    return { success: false, error: "GitHub organization not specified" };
  }

  try {
    const base64Content = Buffer.from(content).toString("base64");
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message,
          content: base64Content,
          sha,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `Failed to commit file: ${res.status} ${errorData.message || ""}`,
      };
    }

    const resData = await res.json();
    return {
      success: true,
      sha: resData.content.sha,
    };
  } catch (err) {
    console.error("Error committing file to GitHub:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function toggleGitHubIssueReaction(
  repoName: string,
  issueNumber: number,
  userLogin: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; liked: boolean; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token) return { success: false, liked: false, error: "GITHUB_TOKEN not set" };
  if (!targetOrg) return { success: false, liked: false, error: "GITHUB_ORGANIZATION not set" };

  try {
    // 1. Get existing reactions on the issue
    const listRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/${issueNumber}/reactions`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.squirrel-girl-preview+json",
        },
      }
    );

    if (!listRes.ok) {
      throw new Error(`Failed to list reactions: ${listRes.status}`);
    }

    const reactions = await listRes.json();
    // Find thumbs up (+1) reaction from the user
    const userReaction = reactions.find(
      (r: any) => r.content === "+1" && r.user.login.toLowerCase() === userLogin.toLowerCase()
    );

    if (userReaction) {
      // 2. Delete the reaction (unlike)
      const delRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/reactions/${userReaction.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.squirrel-girl-preview+json",
          },
        }
      );

      if (!delRes.ok && delRes.status !== 204) {
        throw new Error(`Failed to delete reaction: ${delRes.status}`);
      }

      return { success: true, liked: false };
    } else {
      // 3. Add reaction (like)
      const addRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/${issueNumber}/reactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.squirrel-girl-preview+json",
          },
          body: JSON.stringify({ content: "+1" }),
        }
      );

      if (!addRes.ok) {
        throw new Error(`Failed to add reaction: ${addRes.status}`);
      }

      return { success: true, liked: true };
    }
  } catch (err) {
    console.error("Error toggling GitHub reaction:", err);
    return { success: false, liked: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function createGitHubIssueComment(
  repoName: string,
  issueNumber: number,
  body: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; comment?: any; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token) return { success: false, error: "GITHUB_TOKEN not set" };
  if (!targetOrg) return { success: false, error: "GITHUB_ORGANIZATION not set" };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ body }),
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to create comment: ${res.status}`);
    }

    const commentData = await res.json();
    return {
      success: true,
      comment: commentData,
    };
  } catch (err) {
    console.error("Error creating GitHub comment:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function triggerSyncWorkflow(): Promise<{ success: boolean; error?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_ORGANIZATION || "cl-andro";
  const repo = process.env.GITHUB_MAIN_REPO || "git-city";

  if (!token) return { success: false, error: "GITHUB_TOKEN not set" };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          event_type: "post_created",
        }),
      }
    );

    if (res.status === 204) {
      return { success: true };
    } else {
      const errText = await res.text();
      return { success: false, error: `Status ${res.status}: ${errText}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function fetchGitHubIssueCommentsAndLikes(
  repoName: string,
  issueNumber: number,
  currentDevLogin?: string,
  orgName?: string
): Promise<{ comments: any[]; likesCount: number; likedByMe: boolean }> {
  const token = process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;
  if (!token || !targetOrg) return { comments: [], likesCount: 0, likedByMe: false };

  try {
    const [commentsRes, reactionsRes] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/${issueNumber}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        }
      ),
      fetch(
        `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/issues/${issueNumber}/reactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.squirrel-girl-preview+json",
          },
        }
      ),
    ]);

    let comments = [];
    if (commentsRes.ok) {
      const ghComments = await commentsRes.json();
      // Map GitHub comment format to social feed format
      comments = ghComments.map((c: any) => ({
        id: c.id,
        content: c.body,
        created_at: c.created_at,
        developer: {
          github_login: c.user.login,
          avatar_url: c.user.avatar_url,
          name: c.user.login,
        },
      }));
    }

    let likesCount = 0;
    let likedByMe = false;
    if (reactionsRes.ok) {
      const reactions = await reactionsRes.json();
      const thumbsUp = reactions.filter((r: any) => r.content === "+1");
      likesCount = thumbsUp.length;
      if (currentDevLogin) {
        likedByMe = thumbsUp.some((r: any) => r.user.login.toLowerCase() === currentDevLogin.toLowerCase());
      }
    }

    return { comments, likesCount, likedByMe };
  } catch (err) {
    console.error(`Error fetching GitHub comments/reactions for issue ${issueNumber}:`, err);
    return { comments: [], likesCount: 0, likedByMe: false };
  }
}

export async function fetchFileFromGitHub(
  repoName: string,
  path: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; content?: string; sha?: string; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token || !targetOrg) {
    return { success: false, error: "Credentials or organization not set" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "git-city-app",
        },
      }
    );

    if (!res.ok) {
      return { success: false, error: `Failed to fetch file: ${res.status}` };
    }

    const data = await res.json();
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { success: true, content, sha: data.sha };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteFileFromGitHub(
  repoName: string,
  path: string,
  message: string,
  sha: string,
  userToken?: string,
  orgName?: string
): Promise<{ success: boolean; error?: string }> {
  const token = userToken || process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!token || !targetOrg) {
    return { success: false, error: "Credentials or organization not set" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/contents/${path}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
          "User-Agent": "git-city-app",
        },
        body: JSON.stringify({
          message,
          sha,
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `Failed to delete file: ${res.status} ${errorData.message || ""}`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Error deleting file from GitHub:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function syncPostToUserRepoDirect(
  post: { id: number; content: string; created_at: string },
  dev: { id: number; github_login: string; name: string | null; avatar_url: string | null; assigned_repo: string; assigned_repo_url: string | null },
  userToken: string
): Promise<{ success: boolean; issueNumber?: number; error?: string }> {
  try {
    // 1. Create Issue
    const title = post.content.trim().split("\n")[0].substring(0, 50) || `Post by @${dev.github_login}`;
    const issueRes = await createGitHubIssue(dev.assigned_repo, title, post.content.trim(), userToken);
    if (!issueRes.success || !issueRes.issueNumber) {
      return { success: false, error: issueRes.error || "Failed to create issue on GitHub" };
    }
    const issueNumber = issueRes.issueNumber;

    // 2. Format postData
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

    // 3. Commit JSON file
    const date = new Date(post.created_at);
    const year = date.getFullYear();
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, "0");
    const gitPath = `posts/${year}/${month}/${day}/${post.id}.json`;

    const commitMessage = `Add post ${post.id} via GitSocial`;
    const commitJsonRes = await commitFileToGitHub(
      dev.assigned_repo,
      gitPath,
      JSON.stringify(postData, null, 2),
      commitMessage,
      undefined, // sha
      userToken
    );
    if (!commitJsonRes.success) {
      return { success: false, issueNumber, error: commitJsonRes.error || "Failed to commit post JSON" };
    }

    // 4. Prepend to user's feed_0.json (with chunking)
    let currentPage = 0;
    let currentIncoming = [postData];
    const targetOrg = process.env.GITHUB_ORGANIZATION || "cl-andro";

    while (currentIncoming.length > 0) {
      const chunkPath = `feed_${currentPage}.json`;
      let existingPosts: any[] = [];
      let pageSha: string | undefined = undefined;

      const fetchRes = await fetchFileFromGitHub(dev.assigned_repo, chunkPath, userToken, targetOrg);
      if (fetchRes.success && fetchRes.content) {
        try {
          pageSha = fetchRes.sha;
          existingPosts = JSON.parse(fetchRes.content);
        } catch (e) {
          console.warn(`Could not parse user ${chunkPath}, starting fresh:`, e);
        }
      }

      const incomingIds = new Set(currentIncoming.map(p => p.id));
      const filteredExisting = existingPosts.filter(p => !incomingIds.has(p.id));

      const merged = [...currentIncoming, ...filteredExisting];
      const stays = merged.slice(0, 100);
      const leftovers = merged.slice(100);

      const commitRes = await commitFileToGitHub(
        dev.assigned_repo,
        chunkPath,
        JSON.stringify(stays, null, 2),
        `Update ${chunkPath} (page ${currentPage})`,
        pageSha,
        userToken,
        targetOrg
      );

      if (!commitRes.success) {
        return { success: false, issueNumber, error: commitRes.error || `Failed to update ${chunkPath}` };
      }

      currentIncoming = leftovers;
      currentPage++;
    }

    return { success: true, issueNumber };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error in direct sync" };
  }
}

export async function setupUserRepoCollaborator(
  login: string,
  repoName: string,
  userToken: string,
  orgName?: string
): Promise<{ success: boolean; error?: string }> {
  const adminToken = process.env.GITHUB_TOKEN;
  const targetOrg = orgName ?? process.env.GITHUB_ORGANIZATION;

  if (!adminToken) {
    return { success: false, error: "Admin GitHub token not configured" };
  }

  if (!targetOrg) {
    return { success: false, error: "GitHub organization not specified" };
  }

  try {
    // 1. Invite user as collaborator with push/write permission
    const inviteRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(targetOrg)}/${encodeURIComponent(repoName)}/collaborators/${encodeURIComponent(login)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          permission: "write",
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (inviteRes.status === 204) {
      console.log(`User @${login} is already a collaborator on ${repoName}.`);
      return { success: true };
    }

    if (inviteRes.status === 201) {
      const inviteData = await inviteRes.json();
      const invitationId = inviteData.id;
      console.log(`Created collaborator invitation ${invitationId} for @${login} on ${repoName}.`);

      // 2. Accept the invitation using the user's OAuth token
      const acceptRes = await fetch(
        `https://api.github.com/user/repository_invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${userToken}`,
            Accept: "application/vnd.github+json",
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (acceptRes.ok || acceptRes.status === 204) {
        console.log(`Successfully accepted collaborator invitation ${invitationId} on behalf of @${login}.`);
        return { success: true };
      } else {
        const acceptError = await acceptRes.json().catch(() => ({}));
        return {
          success: false,
          error: `Failed to accept repository invitation: ${acceptRes.status} ${acceptError.message || ""}`,
        };
      }
    }

    const inviteError = await inviteRes.json().catch(() => ({}));
    return {
      success: false,
      error: `Failed to invite collaborator: ${inviteRes.status} ${inviteError.message || ""}`,
    };
  } catch (err) {
    console.error("Error setting up repository collaborator:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}


