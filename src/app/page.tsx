import { createServerSupabase } from "@/lib/supabase-server";
import { getActivePool } from "@/lib/landmarks/repository";
import { chooseLandmarks, computeSeed } from "@/lib/landmarks/selection";
import HomeClient from "./_components/home-client";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ landmark?: string | string[] }>;
}) {
  const [pool, sb, sp] = await Promise.all([
    getActivePool(),
    createServerSupabase(),
    searchParams,
  ]);

  const { data: { user } } = await sb.auth.getUser();
  const login =
    (user?.user_metadata?.user_name as string | undefined)?.toLowerCase() ??
    (user?.user_metadata?.preferred_username as string | undefined)?.toLowerCase() ??
    null;

  const landmarkParam = Array.isArray(sp.landmark) ? sp.landmark[0] : sp.landmark;

  const seed = computeSeed(login);
  const assignments = chooseLandmarks(pool, seed, login, {
    forceIncludeSlug: landmarkParam,
  });

  return <HomeClient assignments={assignments} />;
}
