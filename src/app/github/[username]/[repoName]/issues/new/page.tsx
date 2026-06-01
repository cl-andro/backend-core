import NewIssueClient from "./_components/new-issue-client";

interface Props {
  params: Promise<{
    username: string;
    repoName: string;
  }>;
}

export async function generateMetadata({ params }: Props) {
  const { username, repoName } = await params;
  return {
    title: `New Issue - ${username}/${repoName} | Cluster`,
    description: `Raise a new issue on ${username}/${repoName} repository.`,
  };
}

export default async function NewIssuePage({ params }: Props) {
  const { username, repoName } = await params;

  return (
    <NewIssueClient
      username={username}
      repoName={repoName}
    />
  );
}
