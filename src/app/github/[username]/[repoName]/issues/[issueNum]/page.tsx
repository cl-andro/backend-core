import { notFound } from "next/navigation";
import { fetchSingleIssue, fetchIssueComments } from "@/lib/github-actions";
import IssueClient from "./_components/issue-client";

interface Props {
  params: Promise<{
    username: string;
    repoName: string;
    issueNum: string;
  }>;
}

export async function generateMetadata({ params }: Props) {
  const { username, repoName, issueNum } = await params;
  return {
    title: `Issue #${issueNum} - ${username}/${repoName} | Cluster`,
    description: `View issue details and comments for issue #${issueNum} on ${username}/${repoName}.`,
  };
}

export default async function IssueDetailPage({ params }: Props) {
  const { username, repoName, issueNum } = await params;
  const issueNumber = parseInt(issueNum, 10);

  if (isNaN(issueNumber)) {
    notFound();
  }

  // Fetch repository details to get the fallback html_url
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-city-app",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const repoRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`,
    { headers, next: { revalidate: 3600 } }
  );

  let repoHtmlUrl = `https://github.com/${username}/${repoName}`;
  if (repoRes.ok) {
    const repo = await repoRes.json();
    repoHtmlUrl = repo.html_url;
  }

  // Pre-fetch issue details and comments
  const [issueData, commentsData] = await Promise.all([
    fetchSingleIssue(username, repoName, issueNumber),
    fetchIssueComments(username, repoName, issueNumber),
  ]);

  return (
    <IssueClient
      username={username}
      repoName={repoName}
      issueNum={issueNumber}
      repoHtmlUrl={repoHtmlUrl}
      issueData={issueData}
      commentsData={commentsData}
    />
  );
}
