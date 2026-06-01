"use client";

import { useState } from "react";
import { 
  Github, 
  ExternalLink, 
  Star, 
  GitFork, 
  AlertCircle, 
  MessageCircle, 
  Search,
  MapPin,
  Link as LinkIcon,
  Users,
  FolderOpen,
  PlusCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import GitHubSearchBox from "@/components/GitHubSearchBox";

interface GitHubProfileClientProps {
  username: string;
  profile: any;
  initialRepos: any[];
}

export default function GitHubProfileClient({
  username,
  profile,
  initialRepos,
}: GitHubProfileClientProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRepos = initialRepos.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] pb-16 md:pb-6">
      
      {/* 1. COVER PHOTO BANNER */}
      <div className="w-full bg-gradient-to-r from-[#1f2937] to-[#111827] h-48 md:h-64 relative border-b border-[#dadde1]" />

      {/* 2. PROFILE HEADER CARD */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 relative -mt-16 md:-mt-24 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 md:p-6 flex flex-col md:flex-row items-center md:items-end gap-6">
          {/* Avatar with white border overlap */}
          <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white overflow-hidden shadow-md shrink-0 bg-white">
            {profile.avatar_url && (
              <Image
                src={profile.avatar_url}
                alt={profile.login}
                fill
                sizes="(max-width: 768px) 128px, 160px"
                className="object-cover"
              />
            )}
          </div>

          {/* Profile Details */}
          <div className="flex-1 text-center md:text-left space-y-1.5 pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-[#1c1e21]">{profile.name || profile.login}</h1>
              <span className="inline-block bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full border border-gray-200">
                GitHub Account
              </span>
            </div>
            <p className="text-sm text-[#65676b] font-mono">@{profile.login}</p>
            
            {profile.bio && (
              <p className="text-sm text-gray-700 max-w-2xl leading-relaxed mt-2">{profile.bio}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-end pb-2">
            <Link
              href="/"
              className="bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm px-4 py-2 rounded-md border border-gray-300 shadow-sm transition-colors"
            >
              Back to Feed
            </Link>
            
            <a
              href={profile.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#24292e] hover:bg-[#1f2327] text-white font-bold text-sm px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* 3. TWO-COLUMN LAYOUT */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 grid grid-cols-12 gap-6">
        
        {/* Left Column - Intro details & search box */}
        <div className="col-span-12 md:col-span-5 space-y-6">
          
          {/* Intro Box */}
          <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-4">
            <h2 className="text-base font-bold text-[#1c1e21]">GitHub Stats & Details</h2>
            
            <div className="space-y-3.5 text-sm text-gray-700">
              {profile.company && (
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-gray-500 w-5 shrink-0">🏢</span>
                  <span className="truncate">{profile.company}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </div>
              )}
              {profile.blog && (
                <div className="flex items-center gap-2.5">
                  <LinkIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <a 
                    href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[#1877f2] hover:underline truncate"
                  >
                    {profile.blog}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2.5 border-t border-gray-100 pt-3">
                <Users className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex gap-3 text-xs">
                  <span><strong className="text-gray-900">{profile.followers}</strong> followers</span>
                  <span>•</span>
                  <span><strong className="text-gray-900">{profile.following}</strong> following</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <FolderOpen className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-xs"><strong className="text-gray-900">{profile.public_repos}</strong> public repositories</span>
              </div>
            </div>
          </div>

          {/* GitHub Lookup Search Widget */}
          <GitHubSearchBox />

        </div>

        {/* Right Column - Repositories list */}
        <div className="col-span-12 md:col-span-7 space-y-4">
          
          {/* Header Card with Repo Search */}
          <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1c1e21]">Repositories</h2>
              <p className="text-xs text-gray-500">Showing {filteredRepos.length} public repositories</p>
            </div>
            
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Search repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#f0f2f5] border border-gray-300 rounded-md text-xs px-3 py-1.5 pl-8 focus:outline-none focus:ring-1 focus:ring-[#1877f2] text-black"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>

          {/* Repository Cards list */}
          <div className="space-y-4">
            {filteredRepos.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-8 text-center text-gray-500">
                <FolderOpen className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="font-bold text-sm">No repositories found</p>
                <p className="text-xs text-gray-400 mt-1">Try matching another spelling or keyword.</p>
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <div key={repo.id} className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                       <Link
                         href={`/github/${username}/${repo.name}`}
                         className="text-base font-bold text-[#3b5998] hover:underline"
                       >
                         {repo.name}
                       </Link>
                      {repo.private ? (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Private</span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">Public</span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{repo.description}</p>
                    )}
                  </div>

                  {/* Repo Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                    {repo.language && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#1877f2]" />
                        <span>{repo.language}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-gray-400" />
                      <span>{repo.stargazers_count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitFork className="h-3.5 w-3.5 text-gray-400" />
                      <span>{repo.forks_count}</span>
                    </div>
                    {repo.updated_at && (
                      <div className="text-[10px] text-gray-400">
                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/github/${username}/${repo.name}?tab=issues`}
                      className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-1.5 px-3 rounded-md border border-[#ccd0d5] flex items-center gap-1.5 transition-colors"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-[#1877f2]" />
                      View Issues
                    </Link>
                    
                    <Link
                      href={`/github/${username}/${repo.name}/issues/new`}
                      className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-1.5 px-3 rounded-md border border-[#ccd0d5] flex items-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-green-600" />
                      Raise Issue
                    </Link>
                    
                    <Link
                      href={`/github/${username}/${repo.name}?tab=discussions`}
                      className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-1.5 px-3 rounded-md border border-[#ccd0d5] flex items-center gap-1.5 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                      Discussions
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Navigation Bar for mobile devices */}
      <BottomNav activeTab="profile" />
    </div>
  );
}
