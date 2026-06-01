import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectPath = searchParams.get("redirect") ?? "/";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3001";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  // Log to workspace file for precise debugging
  try {
    const fs = require("fs");
    const path = require("path");
    const logMsg = `[${new Date().toISOString()}] URL: ${request.url} | Host: ${request.headers.get("host")} | X-Forwarded-Host: ${request.headers.get("x-forwarded-host")} | Computed Origin: ${origin}\n`;
    fs.appendFileSync(path.join(process.cwd(), "debug_oauth.txt"), logMsg);
  } catch (e) {}

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      scopes: "repo user:follow",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
