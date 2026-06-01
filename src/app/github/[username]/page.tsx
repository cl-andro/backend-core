import { notFound } from "next/navigation";
import GitHubProfileClient from "./_components/github-profile-client";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return {
    title: `@${username} - GitHub Repository Viewer | Cluster`,
    description: `Browse @${username}'s public repositories, open issues, and join discussions on GitHub.`,
  };
}

export default async function GitHubProfilePage({ params }: Props) {
  const { username } = await params;

  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 1. Fetch User Profile
  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers,
    next: { revalidate: 3600 }, // cache for 1 hour
  });

  if (userRes.status === 404) {
    notFound();
  }

  if (!userRes.ok) {
    throw new Error(`Failed to fetch user from GitHub API: ${userRes.status} ${userRes.statusText}`);
  }

  const profile = await userRes.json();

  // 2. Fetch User Repositories
  const reposRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`,
    {
      headers,
      next: { revalidate: 3600 },
    }
  );

  let repos = [];
  if (reposRes.ok) {
    repos = await reposRes.json();
  } else {
    console.error(`Failed to fetch repos: ${reposRes.status} ${reposRes.statusText}`);
  }

  return (
    <GitHubProfileClient
      username={username}
      profile={profile}
      initialRepos={repos}
    />
  );
}
