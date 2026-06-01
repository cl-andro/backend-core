import { notFound } from "next/navigation";
import { fetchSingleDiscussion } from "@/lib/github-actions";
import DiscussionClient from "./_components/discussion-client";

interface Props {
  params: Promise<{
    username: string;
    repoName: string;
    discussionNum: string;
  }>;
}

export async function generateMetadata({ params }: Props) {
  const { username, repoName, discussionNum } = await params;
  return {
    title: `Discussion #${discussionNum} - ${username}/${repoName} | Cluster`,
    description: `View discussion thread #${discussionNum} on ${username}/${repoName}.`,
  };
}

export default async function DiscussionDetailPage({ params }: Props) {
  const { username, repoName, discussionNum } = await params;
  const discussionNumber = parseInt(discussionNum, 10);

  if (isNaN(discussionNumber)) {
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

  // Fetch GraphQL discussion details
  const discussionData = await fetchSingleDiscussion(username, repoName, discussionNumber);

  return (
    <DiscussionClient
      username={username}
      repoName={repoName}
      discussionNum={discussionNumber}
      repoHtmlUrl={repoHtmlUrl}
      discussionData={discussionData}
    />
  );
}
