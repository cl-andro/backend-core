import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { providerToken } = body;
    if (!providerToken) {
      return NextResponse.json({ error: "Missing providerToken" }, { status: 400 });
    }

    const login = (
      user.user_metadata?.user_name ??
      user.user_metadata?.preferred_username ??
      ""
    ).toLowerCase();

    const admin = getSupabaseAdmin();
    
    // Update the github_token in the developers table securely
    const { error } = await admin
      .from("developers")
      .update({ github_token: providerToken })
      .eq("github_login", login);

    if (error) {
      console.error("Error updating github_token in session sync:", error);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    // Debug logging to track successful syncs
    try {
      const fs = require("fs");
      const path = require("path");
      const logMsg = `[${new Date().toISOString()}] SESSION_SYNC: User: ${user.email} | Login: ${login} | Token synced successfully!\n`;
      fs.appendFileSync(path.join(process.cwd(), "debug_oauth.txt"), logMsg);
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in session sync handler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
