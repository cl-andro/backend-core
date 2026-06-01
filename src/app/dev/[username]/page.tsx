import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOwnedItems } from "@/lib/items";
import { TIER_COLORS } from "@/lib/achievements";
import { inferDistrict } from "@/lib/github";
import { ITEM_NAMES } from "@/lib/zones";
import { rankFromLevel, tierFromLevel, levelProgress, xpForLevel } from "@/lib/xp";
import ClaimButton from "@/components/ClaimButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import ShareButtons from "@/components/ShareButtons";
import CompareChallenge from "@/components/CompareChallenge";
import FollowButton from "@/components/FollowButton";
import FollowStats from "@/components/FollowStats";
import ProfileDistrict from "@/components/ProfileDistrict";
import ReferralCTA from "@/components/ReferralCTA";
import ProfileTracker from "@/components/ProfileTracker";
import { Github, ExternalLink, MessageCircle, AlertCircle } from "lucide-react";
import ProfileClient from "./_components/profile-client";
import GitHubSearchBox from "@/components/GitHubSearchBox";
import CollapsibleStats from "./_components/collapsible-stats";

export const revalidate = 3600; // ISR: regenerate every 1 hour

interface Props {
  params: Promise<{ username: string }>;
}

const getDeveloper = cache(async (username: string) => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("developers")
    .select("*")
    .eq("github_login", username.toLowerCase())
    .single();
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) {
    return { title: "Developer Not Found - Git City" };
  }

  const contribs = (dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions;
  const title = `@${dev.github_login} - Git City | ${contribs.toLocaleString()} contributions`;
  const description = `See @${dev.github_login}'s building in Git City. ${contribs.toLocaleString()} contributions, ${dev.public_repos.toLocaleString()} repos, ${dev.total_stars.toLocaleString()} stars. Rank #${dev.rank ?? "?"} in the city.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      creator: "@samuelrizzondev",
      site: "@samuelrizzondev",
    },
  };
}

interface AchievementRow {
  achievement_id: string;
  name: string;
  tier: string;
}

export default async function DevPage({ params }: Props) {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) notFound();

  const accent = "#c8e64a";
  const shadow = "#5a7a00";
  const ownedItems = await getOwnedItems(dev.id);

  // Fetch achievements with name+tier from DB (no hardcoded maps)
  const sb = getSupabaseAdmin();
  const { data: devAchievements } = await sb
    .from("developer_achievements")
    .select("achievement_id, achievements(name, tier)")
    .eq("developer_id", dev.id);
  const achievements: AchievementRow[] = (devAchievements ?? []).map((a: Record<string, unknown>) => ({
    achievement_id: a.achievement_id as string,
    name: (a.achievements as Record<string, unknown>)?.name as string ?? (a.achievement_id as string),
    tier: (a.achievements as Record<string, unknown>)?.tier as string ?? "bronze",
  }));

  // Fetch referred developers (who this dev brought to the city)
  const { data: referredDevs } = await sb
    .from("developers")
    .select("github_login, avatar_url")
    .eq("referred_by", dev.github_login)
    .order("claimed_at", { ascending: false })
    .limit(20);

  // Check if the logged-in user owns this building
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const authLogin = (
    user?.user_metadata?.user_name ??
    user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();
  const isOwner = !!user && authLogin === dev.github_login.toLowerCase() && dev.claimed;

  // Fire-and-forget: earn PX for visiting another dev's profile
  if (user && authLogin && !isOwner) {
    const sb = getSupabaseAdmin();
    sb.from("developers")
      .select("id")
      .eq("github_login", authLogin)
      .single()
      .then(({ data: viewer }) => {
        if (viewer) {
          import("@/lib/pixels").then(({ earnPixels }) => {
            const today = new Date().toISOString().slice(0, 10);
            earnPixels(viewer.id, "visit_city", dev.id.toString(), `visit:${today}:${viewer.id}`);
          }).catch(() => {});
        }
      });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: dev.name ?? dev.github_login,
      alternateName: dev.github_login,
      image: dev.avatar_url,
      url: `${baseUrl}/dev/${dev.github_login}`,
      sameAs: `https://github.com/${dev.github_login}`,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Git City", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: `@${dev.github_login}`,
        item: `${baseUrl}/dev/${dev.github_login}`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#f0f2f5] font-sans text-[#1c1e21] pb-16 md:pb-6">
      <ProfileTracker login={dev.github_login} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* 1. COVER PHOTO BANNER */}
      <div className="w-full bg-gradient-to-r from-[#3b5998] to-[#166fe5] h-48 md:h-64 relative border-b border-[#dadde1]" />

      {/* 2. PROFILE HEADER CARD */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 relative -mt-16 md:-mt-24 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 md:p-6 flex flex-col md:flex-row items-center md:items-end gap-6">
          {/* Avatar with white border overlay */}
          <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white overflow-hidden shadow-md shrink-0 bg-white">
            {dev.avatar_url && (
              <Image
                src={dev.avatar_url}
                alt={dev.github_login}
                fill
                sizes="(max-width: 768px) 128px, 160px"
                className="object-cover"
              />
            )}
          </div>

          {/* Profile Details */}
          <div className="flex-1 text-center md:text-left space-y-1.5 pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-[#1c1e21]">{dev.name || dev.github_login}</h1>
              {dev.rank && (
                <span className="inline-block bg-[#e7f3ff] text-[#1877f2] font-bold text-xs px-2.5 py-1 rounded-full">
                  Rank #{dev.rank}
                </span>
              )}
            </div>
            <p className="text-sm text-[#65676b] font-mono">@{dev.github_login}</p>
            
            {dev.bio && (
              <p className="text-sm text-gray-700 max-w-2xl leading-relaxed mt-2 normal-case">{dev.bio}</p>
            )}

            <FollowStats
              targetUsername={dev.github_login}
              initialFollowers={dev.followers ?? 0}
              initialFollowing={dev.following ?? 0}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-end pb-2">
            {dev.district && (
              <ProfileDistrict
                district={dev.district}
                districtRank={dev.district_rank}
                inferredDistrict={inferDistrict(dev.primary_language)}
                isOwner={isOwner}
                districtChosen={dev.district_chosen ?? false}
                districtChangesCount={dev.district_changes_count ?? 0}
                districtChangedAt={dev.district_changed_at ?? null}
              />
            )}
            
            <ClaimButton githubLogin={dev.github_login} claimed={dev.claimed ?? false} />

            <FollowButton targetUsername={dev.github_login} />

            <a
              href={`https://github.com/${dev.github_login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-black bg-white hover:bg-gray-50 text-black font-bold text-sm px-4 py-2 rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5 font-sans cursor-pointer"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            
            {isOwner && (
              <Link
                href={`/shop/${dev.github_login}`}
                className="border-2 border-black bg-white hover:bg-gray-50 text-black font-bold text-sm px-4 py-2 rounded-md transition-colors shadow-sm inline-block font-sans cursor-pointer"
              >
                Customize
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 3. TWO-COLUMN LAYOUT */}
      <div className="max-w-6xl mx-auto px-3 md:px-4 grid grid-cols-12 gap-6">
        
        {/* Left Column (Intro details, achievements, XP, etc.) */}
        <div className="col-span-12 md:col-span-5 space-y-6">
          
          {/* Intro Box */}
          <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-4">
            <h2 className="text-base font-bold text-[#1c1e21]">Intro</h2>
            
            {/* Stats Grid */}
            <div className="space-y-2">
              {/* Row 1 (Main Stats) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Contributions", value: ((dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions).toLocaleString() },
                  { label: "Repos", value: dev.public_repos.toLocaleString() },
                  { label: "Stars", value: dev.total_stars.toLocaleString() },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#f0f2f5] p-2 rounded-lg border border-[#e4e6eb] flex flex-col justify-center min-h-[56px]">
                    <div className="text-sm font-bold text-[#1877f2] truncate">{stat.value}</div>
                    <div className="text-[8px] uppercase tracking-wider text-[#65676b] font-bold mt-0.5 leading-tight">{stat.label}</div>
                  </div>
                ))}
              </div>
              
              {/* Row 2 (Secondary/Smaller Stats) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Kudos", value: (dev.kudos_count ?? 0).toLocaleString() },
                  { label: "Visits", value: (dev.visit_count ?? 0).toLocaleString() },
                  { label: "Referrals", value: (dev.referral_count ?? 0).toLocaleString() },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#f0f2f5] p-1.5 rounded-lg border border-[#e4e6eb] flex flex-col justify-center min-h-[48px]">
                    <div className="text-xs font-bold text-[#1877f2] truncate">{stat.value}</div>
                    <div className="text-[7.5px] uppercase tracking-wider text-[#65676b] font-bold mt-0.5 leading-tight">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Share & Compare */}
            <div className="border-t border-[#e5e5e5] pt-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ShareButtons
                  login={dev.github_login}
                  contributions={(dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions}
                  rank={dev.rank}
                  accent="#1877f2"
                  shadow="#166fe5"
                />
              </div>
              <CompareChallenge login={dev.github_login} accent="#1877f2" shadow="#166fe5" />
            </div>

            {/* Assigned Repository */}
            {dev.assigned_repo && (
              <div className="border-t border-[#e5e5e5] pt-3 text-xs flex items-center justify-between">
                <span className="text-gray-500 font-medium">Organization Repo:</span>
                <Link
                  href={dev.assigned_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1877f2] font-bold hover:underline inline-flex items-center gap-1 font-mono"
                >
                  {dev.assigned_repo}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          <GitHubSearchBox />

          {/* GitHub External Actions (For Guest Interaction) */}
          {dev.assigned_repo && (
            <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3.5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <Github className="h-5 w-5 text-gray-800" />
                <h2 className="text-sm font-bold text-[#1c1e21]">GitHub External Actions</h2>
              </div>
              <p className="text-xs text-[#65676b] leading-relaxed normal-case">
                Not logged in with a GitSocial account? You can still comment, raise issues, or join discussions using your GitHub account directly in this developer's assigned repo.
              </p>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <Link
                  href={`${dev.assigned_repo_url}/issues/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-2 px-3 rounded-md border border-[#ccd0d5] flex items-center justify-center gap-2 transition-colors"
                >
                  <AlertCircle className="h-4 w-4 text-gray-600" />
                  Raise Issue on GitHub
                </Link>
                <Link
                  href={`${dev.assigned_repo_url}/discussions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-2 px-3 rounded-md border border-[#ccd0d5] flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="h-4 w-4 text-gray-600" />
                  Join Repository Discussions
                </Link>
                <Link
                  href={dev.assigned_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#f0f2f5] hover:bg-[#e4e6eb] text-gray-800 text-xs font-bold py-2 px-3 rounded-md border border-[#ccd0d5] flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-gray-600" />
                  View Assigned Repository
                </Link>
              </div>
            </div>
          )}

          <CollapsibleStats>
            {/* XP & Level */}
            {(() => {
              const xpLevel = dev.xp_level ?? 1;
              const xpTotal = dev.xp_total ?? 0;
              const tier = tierFromLevel(xpLevel);
              const rank = rankFromLevel(xpLevel);
              const progress = levelProgress(xpTotal);
              const xpCurrent = xpTotal - xpForLevel(xpLevel);
              const xpNeeded = xpForLevel(xpLevel + 1) - xpForLevel(xpLevel);
              return (
                <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3">
                  <h2 className="text-sm font-bold text-[#1c1e21]">XP & Level Progress</h2>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center border-2 rounded-full text-sm font-bold"
                      style={{ borderColor: tier.color, color: tier.color }}
                    >
                      {xpLevel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: tier.color }}>
                          {rank.title}
                        </span>
                        <span
                          className="px-1.5 py-0.5 text-[8px] font-bold rounded"
                          style={{ backgroundColor: tier.color + "22", color: tier.color }}
                        >
                          {tier.name.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, Math.round(progress * 100))}%`,
                              backgroundColor: tier.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#65676b] whitespace-nowrap">
                          {xpCurrent.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-gray-400 font-mono">
                    {xpTotal.toLocaleString()} XP total
                  </div>
                </div>
              );
            })()}

            {/* Achievements */}
            {achievements.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1c1e21]">Achievements</h2>
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">{achievements.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {achievements
                    .sort((a, b) => {
                      const tierOrder = ["diamond", "gold", "silver", "bronze"];
                      return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
                    })
                    .map((ach) => {
                      const color = TIER_COLORS[ach.tier] ?? "#1877f2";
                      return (
                        <span
                          key={ach.achievement_id}
                          className="border text-[10px] font-bold px-2.5 py-1 rounded transition-colors hover:opacity-85"
                          style={{ borderColor: color, color, backgroundColor: color + "0b" }}
                        >
                          {ach.name}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Owned Items */}
            {ownedItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3">
                <h2 className="text-sm font-bold text-[#1c1e21]">Building Items</h2>
                <div className="flex flex-wrap gap-1.5">
                  {ownedItems.map((itemId) => (
                    <span
                      key={itemId}
                      className="bg-gray-100 text-gray-700 text-[10px] font-mono px-2.5 py-1 rounded border border-[#e4e6eb]"
                    >
                      {ITEM_NAMES[itemId] ?? itemId}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Invited Developers */}
            {referredDevs && referredDevs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-[#dadde1] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1c1e21]">Invited Devs</h2>
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">{dev.referral_count ?? referredDevs.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {referredDevs.map((rd) => (
                    <Link
                      key={rd.github_login}
                      href={`/dev/${rd.github_login}`}
                      className="flex items-center gap-2 bg-[#f0f2f5] hover:bg-[#e4e6eb] p-1.5 rounded-lg border border-[#e4e6eb] text-xs font-semibold text-gray-700 transition-colors"
                    >
                      {rd.avatar_url && (
                        <div className="relative h-5 w-5 rounded-full overflow-hidden shrink-0">
                          <Image
                            src={rd.avatar_url}
                            alt={rd.github_login}
                            fill
                            sizes="20px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <span className="truncate">@{rd.github_login}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {isOwner && (
              <div className="bg-red-50/50 rounded-lg shadow-sm border border-red-200 p-4 space-y-3">
                <h2 className="text-xs font-bold text-red-600">Danger Zone</h2>
                <p className="text-[10px] text-gray-500 leading-normal normal-case">
                  Permanently delete your account, your building, and all associated data.
                </p>
                <div className="flex justify-end pt-1">
                  <DeleteAccountButton />
                </div>
              </div>
            )}
          </CollapsibleStats>
        </div>

        {/* Right Column (Timeline Feed client component) */}
        <div className="col-span-12 md:col-span-7">
          <ProfileClient
            username={dev.github_login}
            devId={dev.id}
            assignedRepo={dev.assigned_repo}
            assignedRepoUrl={dev.assigned_repo_url}
            displayName={dev.name || dev.github_login}
            avatarUrl={dev.avatar_url}
            isOwner={isOwner}
          />
        </div>
      </div>
    </main>
  );
}
