import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import CardCustomizerClient from "@/components/CardCustomizerClient";

interface Props {
  params: Promise<{ username: string }>;
}

async function getDeveloper(username: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("developers")
    .select("*")
    .eq("github_login", username.toLowerCase())
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) {
    return { title: "Developer Not Found - Cluster" };
  }

  return {
    title: `Customize Card - @${dev.github_login} - Cluster`,
    description: `Design a custom social media preview card for @${dev.github_login}`,
  };
}

export default async function ShopPage({ params }: Props) {
  const { username } = await params;
  const dev = await getDeveloper(username);

  if (!dev) notFound();

  // Check if the logged-in user owns this profile/building
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const authLogin = (
    user?.user_metadata?.user_name ??
    user?.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();
  const isOwner = !!user && authLogin === dev.github_login.toLowerCase();

  // Not the owner or not claimed — show message
  if (!dev.claimed || !isOwner) {
    return (
      <main className="min-h-screen bg-[#f0f2f5] font-sans text-black py-10 px-4">
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/dev/${dev.github_login}`}
            className="mb-6 inline-flex items-center text-sm font-bold text-gray-500 hover:text-black transition-colors"
          >
            &larr; Back to Profile
          </Link>

          <div className="border-4 border-black bg-white p-8 text-center rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="text-xl font-black uppercase tracking-wider">Customizer Locked</h1>
            <p className="mt-3 text-sm text-gray-600">
              {!dev.claimed
                ? `@${dev.github_login} needs to claim their profile before customization is available.`
                : "Only the profile owner can customize their social card. Sign in with the matching GitHub account."}
            </p>
            <Link
              href={`/dev/${dev.github_login}`}
              className="btn-press mt-6 inline-block px-6 py-3 border-2 border-black bg-black text-white hover:bg-gray-800 text-xs font-bold uppercase tracking-wider rounded-md transition-colors"
            >
              View Profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f0f2f5] font-sans text-black py-10 px-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <Link
          href={`/dev/${dev.github_login}`}
          className="mb-6 inline-flex items-center text-sm font-bold text-gray-500 hover:text-black transition-colors"
        >
          &larr; Back to Profile
        </Link>

        {/* Profile mini-card */}
        <div className="mb-6 border-4 border-black bg-white p-5 rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-4">
            {dev.avatar_url && (
              <Image
                src={dev.avatar_url}
                alt={dev.github_login}
                width={56}
                height={56}
                className="border-2 border-black rounded-lg shrink-0"
              />
            )}
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider">Card Customizer</h1>
              <p className="mt-0.5 text-xs text-gray-500 font-medium">
                Design custom card assets for @{dev.github_login}
              </p>
            </div>
          </div>
        </div>

        {/* Card customizer suite */}
        <CardCustomizerClient githubLogin={dev.github_login} />
      </div>
    </main>
  );
}
