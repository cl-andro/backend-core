import { notFound } from "next/navigation";
import RepositoryClient from "./_components/repository-client";
import { fetchRepositoryIssues, fetchRepositoryDiscussions } from "@/lib/github-actions";

interface Props {
  params: Promise<{ username: string; repoName: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username, repoName } = await params;
  return {
    title: `${repoName} - ${username}/GitHub Repository | Cluster`,
    description: `View details of ${username}/${repoName} repository on Cluster.`,
  };
}

export default async function RepositoryPage({ params, searchParams }: Props) {
  const { username, repoName } = await params;
  const { tab = "info" } = await searchParams;

  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-city-app",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Fetch repository details
  const repoRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`,
    { headers, next: { revalidate: 3600 } }
  );

  if (repoRes.status === 404) {
    notFound();
  }

  if (!repoRes.ok) {
    throw new Error(`Failed to fetch repo: ${repoRes.status} ${repoRes.statusText}`);
  }

  const repo = await repoRes.json();

  // Fetch README (optional)
  let readmeContent = "";
  const readmeRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/readme`,
    { headers, next: { revalidate: 3600 } }
  );

  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    if (readmeData.content) {
      readmeContent = Buffer.from(readmeData.content, "base64").toString("utf-8");
    }
  }

  // Pre-fetch issues and discussions
  const [issuesData, discussionsData] = await Promise.all([
    fetchRepositoryIssues(username, repoName),
    fetchRepositoryDiscussions(username, repoName),
  ]);

  return (
    <RepositoryClient
      username={username}
      repoName={repoName}
      repo={repo}
      readmeContent={readmeContent}
      initialTab={tab}
      issuesData={issuesData}
      discussionsData={discussionsData}
    />
  );
}