"use client";

import { useState } from "react";
import Link from "next/link";
import MarkdownViewer from "@/components/MarkdownViewer";
import { 
  Star, 
  GitFork, 
  Eye, 
  BookOpen, 
  Info, 
  AlertCircle, 
  MessageSquare, 
  CornerDownRight, 
  ChevronRight, 
  ExternalLink,
  PlusCircle,
  HelpCircle,
  ShieldAlert
} from "lucide-react";

interface RepositoryClientProps {
  username: string;
  repoName: string;
  repo: any;
  readmeContent: string;
  initialTab?: string;
  issuesData: { success: boolean; issues?: any[]; error?: string };
  discussionsData: { success: boolean; discussions?: any[]; error?: string };
}

export default function RepositoryClient({
  username,
  repoName,
  repo,
  readmeContent,
  initialTab = "info",
  issuesData,
  discussionsData,
}: RepositoryClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isChangingTab, setIsChangingTab] = useState(false);

  const handleTabChange = (tabId: string) => {
    if (tabId === activeTab) return;
    setIsChangingTab(true);
    setActiveTab(tabId);
    setTimeout(() => {
      setIsChangingTab(false);
    }, 450);
  };

  // Parse issues and discussions
  const issues = issuesData.issues || [];
  const discussions = discussionsData.discussions || [];

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] pb-16 md:pb-6">
      
      {/* Top Banner Navigation */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 pt-4 mb-4">
        <Link href={`/github/${username}`} className="inline-flex items-center gap-1 text-[#1877f2] hover:underline text-sm font-semibold transition-colors">
          <span>←</span> Back to @{username}'s profile
        </Link>
      </div>

      {/* 1. REPOSITORY HEADER CARD */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-5 md:p-6 transition-all duration-300 hover:shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-gray-500 text-sm">@{username}</span>
                <span className="text-gray-300">/</span>
                <h1 className="text-xl md:text-2xl font-extrabold text-[#1c1e21] tracking-tight">{repo.name}</h1>
                
                {repo.private ? (
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">Private</span>
                ) : (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">Public</span>
                )}
                {repo.fork && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">Forked</span>
                )}
              </div>

              {repo.description ? (
                <p className="text-sm text-[#4b5563] leading-relaxed max-w-3xl">{repo.description}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No description provided</p>
              )}

              {/* Stats Grid */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500 pt-2">
                <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-gray-700">{repo.stargazers_count}</span>
                  <span className="text-gray-400 font-normal">stars</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                  <GitFork className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-gray-700">{repo.forks_count}</span>
                  <span className="text-gray-400 font-normal">forks</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-gray-700">{repo.watchers_count}</span>
                  <span className="text-gray-400 font-normal">watching</span>
                </div>
                {repo.language && (
                  <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                    <span className="h-2 w-2 rounded-full bg-[#1877f2]" />
                    <span className="text-gray-700">{repo.language}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Header CTA Buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href={`/github/${username}/${repoName}/issues/new`}
                className="bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-sm px-4 py-2 rounded-md shadow-sm transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="h-4 w-4" />
                Raise Issue
              </Link>
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#24292e] hover:bg-[#1f2327] text-white font-bold text-sm px-4 py-2 rounded-md shadow-sm transition-all flex items-center gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                GitHub
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* 2. TAB NAVIGATION HEADER */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 mb-4 relative">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-1 flex relative overflow-hidden">
          {/* Animated Loading Bar at Tab Header Bottom */}
          <div className={`absolute bottom-0 left-0 w-full h-[3px] bg-white overflow-hidden transition-opacity duration-300 z-50 ${
            isChangingTab ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}>
            <div className="h-full bg-gradient-to-r from-[#1877f2] via-[#2b87ff] to-[#1877f2] animate-shimmer-loading w-1/2" />
          </div>
          {[
            { id: "info", label: "Info", icon: Info },
            { id: "readme", label: "README", icon: BookOpen },
            { id: "issues", label: "Issues", icon: AlertCircle, count: repo.open_issues_count },
            { id: "discussions", label: "Discussions", icon: MessageSquare }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-md transition-all ${
                  isActive
                    ? "bg-[#e7f3ff] text-[#1877f2]"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#1877f2]" : "text-gray-400"}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive ? "bg-[#1877f2] text-white" : "bg-gray-100 text-gray-500 border border-gray-200"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="max-w-6xl mx-auto px-3 md:px-4">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-5 md:p-6 min-h-[300px]">
          {isChangingTab ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877f2]" />
              <p className="text-xs text-gray-500 font-semibold animate-pulse">Loading {activeTab}...</p>
            </div>
          ) : (
            <>
              {/* TAB: INFO */}
              {activeTab === "info" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#1c1e21] border-b border-gray-100 pb-2 mb-3">About Repository</h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {repo.description || "This repository has no description."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-2">
                <div className="space-y-3.5">
                  {repo.homepage && (
                    <div className="flex items-center gap-2">
                      <strong className="text-gray-500 w-28 shrink-0">Homepage:</strong>
                      <a href={repo.homepage} target="_blank" rel="noopener noreferrer" className="text-[#1877f2] hover:underline font-medium truncate">
                        {repo.homepage}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-500 w-28 shrink-0">Owner:</strong>
                    <Link href={`/github/${username}`} className="text-[#1877f2] hover:underline font-medium">
                      @{username}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-500 w-28 shrink-0">Open Issues:</strong>
                    <span className="text-gray-700 font-semibold">{repo.open_issues_count}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-500 w-28 shrink-0">Created:</strong>
                    <span className="text-gray-700 font-medium">{new Date(repo.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-500 w-28 shrink-0">Last Pushed:</strong>
                    <span className="text-gray-700 font-medium">{new Date(repo.pushed_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-500 w-28 shrink-0">License:</strong>
                    <span className="text-gray-700 font-medium">{repo.license ? repo.license.name : "None"}</span>
                  </div>
                </div>
              </div>

              {repo.topics && repo.topics.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 mb-2.5">Topics</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {repo.topics.map((topic: string) => (
                      <span key={topic} className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium transition-colors border border-gray-200">
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: README */}
          {activeTab === "readme" && (
            <div className="prose prose-sm max-w-none">
              {readmeContent ? (
                <MarkdownViewer content={readmeContent} />
              ) : (
                <div className="text-center py-10 text-gray-500">
                  <BookOpen className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-sm">No README found</p>
                  <p className="text-xs text-gray-400 mt-1">This repository does not contain a README file at the root.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ISSUES */}
          {activeTab === "issues" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-[#1c1e21]">Issues List</h3>
                <Link
                  href={`/github/${username}/${repoName}/issues/new`}
                  className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition-colors flex items-center gap-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  New Issue
                </Link>
              </div>

              {!issuesData.success ? (
                // Fallback to GitHub on failure/limit cross
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-center">
                  <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="font-bold text-amber-800 text-sm mb-1">GitHub API Rate Limit / Connection Issue</h4>
                  <p className="text-xs text-amber-700 max-w-md mx-auto mb-4">
                    We encountered an issue fetching issues directly. This could be due to a rate limit or network error.
                  </p>
                  <a
                    href={`${repo.html_url}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#24292e] hover:bg-black text-white text-xs font-bold py-2 px-4 rounded-md shadow transition-colors"
                  >
                    <span>View Issues on GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-sm">No issues found</p>
                  <p className="text-xs text-gray-400 mt-1">There are currently no issues reported on this repository.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {issues.map((issue: any) => (
                    <div key={issue.id} className="py-3.5 flex items-start gap-3 hover:bg-gray-50 rounded-lg p-2.5 transition-colors">
                      <div className="mt-0.5">
                        {issue.state === "open" ? (
                          <span className="inline-block h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white ring-1 ring-green-300" title="Open Issue" />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 rounded-full bg-purple-500 border-2 border-white ring-1 ring-purple-300" title="Closed Issue" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/github/${username}/${repoName}/issues/${issue.number}`}
                            className="text-sm font-bold text-[#1c1e21] hover:text-[#1877f2] hover:underline truncate"
                          >
                            {issue.title}
                          </Link>
                          {issue.labels && issue.labels.map((lbl: any) => (
                            <span
                              key={lbl.id}
                              style={{ backgroundColor: `#${lbl.color}`, color: '#fff' }}
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded border border-black/10"
                            >
                              {lbl.name}
                            </span>
                          ))}
                        </div>
                        
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>#{issue.number}</span>
                          <span>•</span>
                          <span>opened by <strong className="text-gray-700">@{issue.user?.login}</strong></span>
                          <span>•</span>
                          <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {issue.comments > 0 && (
                        <div className="flex items-center gap-1 text-gray-400 text-xs font-semibold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{issue.comments}</span>
                        </div>
                      )}
                      
                      <Link href={`/github/${username}/${repoName}/issues/${issue.number}`} className="text-gray-400 hover:text-[#1877f2] p-1 self-center">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: DISCUSSIONS */}
          {activeTab === "discussions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-[#1c1e21]">Discussions</h3>
                <a
                  href={`${repo.html_url}/discussions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition-colors flex items-center gap-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  GitHub Discussions
                </a>
              </div>

              {!discussionsData.success ? (
                // Fallback to GitHub on failure/limit cross
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-center">
                  <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="font-bold text-amber-800 text-sm mb-1">GitHub GraphQL / Discussions Limitation</h4>
                  <p className="text-xs text-amber-700 max-w-md mx-auto mb-4">
                    Discussions require GitHub GraphQL API authentication and permissions, which may be rate-limited or disabled on this repository.
                  </p>
                  <a
                    href={`${repo.html_url}/discussions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#24292e] hover:bg-black text-white text-xs font-bold py-2 px-4 rounded-md shadow transition-colors"
                  >
                    <span>View Discussions on GitHub</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : discussions.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-sm">No discussions found</p>
                  <p className="text-xs text-gray-400 mt-1">There are no discussion threads in this repository.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {discussions.map((discussion: any) => (
                    <div key={discussion.id} className="py-3.5 flex items-start gap-3 hover:bg-gray-50 rounded-lg p-2.5 transition-colors">
                      <div className="text-xl shrink-0 p-1 bg-blue-50 rounded-md border border-blue-100 flex items-center justify-center h-9 w-9">
                        <span>{discussion.category?.emoji || "💬"}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/github/${username}/${repoName}/discussions/${discussion.number}`}
                            className="text-sm font-bold text-[#1c1e21] hover:text-[#1877f2] hover:underline truncate"
                          >
                            {discussion.title}
                          </Link>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded border border-gray-200">
                            {discussion.category?.name}
                          </span>
                        </div>
                        
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>#{discussion.number}</span>
                          <span>•</span>
                          <span>started by <strong className="text-gray-700">@{discussion.author?.login}</strong></span>
                          <span>•</span>
                          <span>{new Date(discussion.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-center">
                        {discussion.upvoteCount > 0 && (
                          <span className="text-xs font-semibold text-gray-500">
                            ▲ {discussion.upvoteCount}
                          </span>
                        )}
                        
                        {discussion.comments?.totalCount > 0 && (
                          <div className="flex items-center gap-1 text-gray-400 text-xs font-semibold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{discussion.comments.totalCount}</span>
                          </div>
                        )}

                        <Link href={`/github/${username}/${repoName}/discussions/${discussion.number}`} className="text-gray-400 hover:text-[#1877f2] p-1">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
