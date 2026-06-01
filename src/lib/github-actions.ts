"use server";

import { ghHeaders } from "./github-api";

const GRAPHQL_URL = "https://api.github.com/graphql";

// Helper to make GraphQL requests
async function runGraphQLQuery(query: string, variables: Record<string, any>, userToken?: string) {
  const token = userToken || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub token is not configured on the server.");
  }

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "git-city-app",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GraphQL API returned status ${res.status}: ${text}`);
  }

  const result = await res.json();
  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    throw new Error(result.errors[0]?.message || "GraphQL query error");
  }

  return result.data;
}

// Helper to construct request headers
function getHeaders(userToken?: string): HeadersInit {
  const headers = ghHeaders();
  if (userToken) {
    return {
      ...headers,
      Authorization: `Bearer ${userToken}`,
    };
  }
  return headers;
}

// 1. Fetch Repository Issues (REST API)
export async function fetchRepositoryIssues(owner: string, repo: string, userToken?: string) {
  try {
    const headers = getHeaders(userToken);
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=50&sort=created&direction=desc`,
      {
        headers,
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch issues: ${res.statusText}`);
    }

    const issues: any[] = await res.json();
    return {
      success: true,
      issues: issues.filter((issue) => !issue.pull_request),
    };
  } catch (error: any) {
    console.error("Error in fetchRepositoryIssues:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      issues: [],
    };
  }
}

// 2. Fetch Single Issue (REST API)
export async function fetchSingleIssue(owner: string, repo: string, issueNum: number, userToken?: string) {
  try {
    const headers = getHeaders(userToken);
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNum}`,
      {
        headers,
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch issue: ${res.statusText}`);
    }

    const issue = await res.json();
    return {
      success: true,
      issue,
    };
  } catch (error: any) {
    console.error("Error in fetchSingleIssue:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// 3. Fetch Issue Comments (REST API)
export async function fetchIssueComments(owner: string, repo: string, issueNum: number, userToken?: string) {
  try {
    const headers = getHeaders(userToken);
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNum}/comments?per_page=100`,
      {
        headers,
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch issue comments: ${res.statusText}`);
    }

    const comments = await res.json();
    return {
      success: true,
      comments,
    };
  } catch (error: any) {
    console.error("Error in fetchIssueComments:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      comments: [],
    };
  }
}

// 4. Create Issue (REST API)
export async function createIssue(owner: string, repo: string, title: string, body: string, userToken?: string) {
  try {
    const headers = getHeaders(userToken);
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create issue: ${res.statusText}`);
    }

    const issue = await res.json();
    return {
      success: true,
      issue,
    };
  } catch (error: any) {
    console.error("Error in createIssue:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// 5. Create Issue Comment (REST API)
export async function createIssueComment(owner: string, repo: string, issueNum: number, body: string, userToken?: string) {
  try {
    const headers = getHeaders(userToken);
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNum}/comments`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create comment: ${res.statusText}`);
    }

    const comment = await res.json();
    return {
      success: true,
      comment,
    };
  } catch (error: any) {
    console.error("Error in createIssueComment:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// 6. Fetch Repository Discussions (GraphQL API)
export async function fetchRepositoryDiscussions(owner: string, repo: string, userToken?: string) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            id
            number
            title
            body
            createdAt
            upvoteCount
            category {
              name
              emoji
            }
            author {
              login
              avatarUrl
            }
            comments {
              totalCount
            }
          }
        }
      }
    }
  `;

  try {
    const data = await runGraphQLQuery(query, { owner, repo }, userToken);
    const discussions = data?.repository?.discussions?.nodes || [];
    return {
      success: true,
      discussions,
    };
  } catch (error: any) {
    console.error("Error fetching repository discussions:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      discussions: [],
    };
  }
}

// 7. Fetch Single Discussion (GraphQL API)
export async function fetchSingleDiscussion(owner: string, repo: string, discussionNum: number, userToken?: string) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) {
          id
          number
          title
          body
          createdAt
          upvoteCount
          author {
            login
            avatarUrl
          }
          comments(first: 50) {
            nodes {
              id
              body
              createdAt
              author {
                login
                avatarUrl
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await runGraphQLQuery(query, { owner, repo, number: discussionNum }, userToken);
    const discussion = data?.repository?.discussion;
    if (!discussion) {
      throw new Error("Discussion not found");
    }
    return {
      success: true,
      discussion,
    };
  } catch (error: any) {
    console.error("Error fetching single discussion:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// 8. Create Discussion Comment (GraphQL Mutation)
export async function createDiscussionComment(discussionId: string, body: string, userToken?: string) {
  const query = `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment {
          id
          body
          createdAt
          author {
            login
            avatarUrl
          }
        }
      }
    }
  `;

  try {
    const data = await runGraphQLQuery(query, { discussionId, body }, userToken);
    const comment = data?.addDiscussionComment?.comment;
    return {
      success: true,
      comment,
    };
  } catch (error: any) {
    console.error("Error creating discussion comment:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
